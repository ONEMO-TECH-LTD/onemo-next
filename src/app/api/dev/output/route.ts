import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { MaterialPresetConfig, TexturePaths } from '@/app/(dev)/prototype/types';
import { FileStudioDocumentStore } from '@/studio/persistence/scenePresetRepository';
import type { StudioDocument } from '@/studio/persistence/studioDocument';
import type {
  StudioMaterialPresetSummary,
  StudioOutputPayload,
  StudioPreset,
  StudioPresetSummary,
} from '@/studio/preset/types';

const GENERATED_DIR = join(process.cwd(), 'src', 'app', 'tokens');
const MATERIAL_PRESETS_DIR = join(process.cwd(), 'data', 'material-presets');
const studioStore = new FileStudioDocumentStore();

const ALLOWED_FILES = new Set([
  'primitives.css',
  'aliases.css',
  'semantic.css',
  'semantic-inline.css',
]);

function countAssignedTextures(textures: Partial<TexturePaths> | undefined) {
  if (!textures) return 0;

  return Object.values(textures).filter((value) => typeof value === 'string' && value.length > 0).length;
}

function getEnvironmentLabel(document: StudioDocument) {
  const hdriPath = document.scene_preset.payload.lighting_rig.hdri.path;
  if (hdriPath.startsWith('/assets/')) {
    return basename(hdriPath).replace(/\.(hdr|hdri|exr)$/i, '');
  }

  return hdriPath.startsWith('preset:') ? hdriPath.replace('preset:', '') : 'studio';
}

function summarizeStudio(document: StudioDocument): StudioPresetSummary {
  const scene = document.scene_preset
  return {
    id: scene.id,
    name: scene.slug,
    created: scene.created_at,
    modified: scene.updated_at,
    modelPath: document.metadata.studio_state.model_path,
    environmentLabel: getEnvironmentLabel(document),
    hasArtwork: Boolean(scene.payload.surface_materials.face.map?.asset.path),
    enabledLights: [
      scene.payload.lighting_rig.key_light,
      scene.payload.lighting_rig.fill_light,
      scene.payload.lighting_rig.rim_light,
    ].filter(Boolean).length,
    postprocessingEnabled: scene.payload.render_settings.shadow_enabled,
    faceTextureCount: countAssignedTextures({
      texture: scene.payload.surface_materials.face.map?.asset.path,
      normal: scene.payload.surface_materials.face.normal_map?.asset.path,
      roughness: scene.payload.surface_materials.face.roughness_map?.asset.path,
      height: scene.payload.surface_materials.face.displacement_map?.asset.path,
    }),
    backTextureCount: countAssignedTextures({
      texture: scene.payload.surface_materials.back.map?.asset.path,
      normal: scene.payload.surface_materials.back.normal_map?.asset.path,
      roughness: scene.payload.surface_materials.back.roughness_map?.asset.path,
      height: scene.payload.surface_materials.back.displacement_map?.asset.path,
    }),
    frameTextureCount: countAssignedTextures({
      texture: scene.payload.surface_materials.frame.map?.asset.path,
      normal: scene.payload.surface_materials.frame.normal_map?.asset.path,
      roughness: scene.payload.surface_materials.frame.roughness_map?.asset.path,
      height: scene.payload.surface_materials.frame.displacement_map?.asset.path,
    }),
  };
}

function summarizeMaterialPreset(preset: MaterialPresetConfig): StudioMaterialPresetSummary {
  return {
    name: preset.name,
    modified: preset.modified,
    faceTextureCount: countAssignedTextures(preset.face.textures),
    backTextureCount: countAssignedTextures(preset.back.textures),
    frameTextureCount: countAssignedTextures(preset.frame.textures),
  };
}

async function safeReadJson<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readSavedStudios() {
  const summaries = await studioStore.listSummaries();
  const studios = await Promise.all(
    summaries.map(async (summary) => {
      return await studioStore.loadDocument(summary.slug);
    }),
  );

  return studios.filter((studio): studio is StudioDocument => Boolean(studio));
}

async function readMaterialPresets() {
  try {
    const files = (await readdir(MATERIAL_PRESETS_DIR))
      .filter((file) => file.endsWith('.json'))
      .sort((left, right) => left.localeCompare(right));

    const presets = await Promise.all(
      files.map((file) => safeReadJson<MaterialPresetConfig>(join(MATERIAL_PRESETS_DIR, file))),
    );

    return presets.filter((preset): preset is MaterialPresetConfig => Boolean(preset));
  } catch {
    return [];
  }
}

async function buildStudioOutputPayload(req: NextRequest): Promise<StudioOutputPayload> {
  const { searchParams } = new URL(req.url);
  const selectedSceneName = searchParams.get('scene') ?? 'default';
  const selectedMaterialPresetName = searchParams.get('materialPreset');

  const [studios, materialPresets] = await Promise.all([readSavedStudios(), readMaterialPresets()]);
  const studioSummaries = studios.map(summarizeStudio);

  const activeStudio =
    studioSummaries.find((studio) => studio.name === selectedSceneName) ??
    studioSummaries.find((studio) => studio.name === 'default') ??
    studioSummaries[0] ??
    null;

  const selectedStudio =
    studios.find((studio) => studio.metadata.slug === (activeStudio?.name ?? selectedSceneName))?.scene_preset ?? null;

  const selectedMaterialPreset =
    materialPresets.find((preset) => preset.name === selectedMaterialPresetName) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    activeStudio,
    studios: studioSummaries,
    materialPresets: materialPresets.map(summarizeMaterialPreset),
    selectedStudio,
    selectedMaterialPreset,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get('file');

  if (filename) {
    if (!ALLOWED_FILES.has(filename)) {
      return NextResponse.json({ error: 'Invalid file parameter' }, { status: 400 });
    }

    try {
      const content = await readFile(join(GENERATED_DIR, filename), 'utf-8');
      return NextResponse.json({ filename, content });
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  const payload = await buildStudioOutputPayload(req);
  return NextResponse.json(payload);
}
