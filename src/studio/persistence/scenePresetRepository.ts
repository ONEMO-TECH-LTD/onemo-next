import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { SceneConfig } from '@/app/(dev)/prototype/types'
import {
  buildStudioOnlyState,
  sceneConfigToScenePreset,
  studioDocumentToSceneConfig,
  summarizeStudioDocument,
  type EffectSubtype,
  type ScenePreset,
  type ScenePresetStatus,
  type StudioDocument,
  type StudioDocumentSummary,
  type StudioOnlyState,
  type StoredStudioDocument,
} from './studioDocument'

export interface PublishResult<T> {
  previous?: T
  published: T
}

export interface ScenePresetRepository {
  getPublishedBySlug(slug: string): Promise<ScenePreset | null>
  getByIdVersion(id: string, version: number): Promise<ScenePreset | null>
  listDrafts(): Promise<ScenePreset[]>
  saveDraft(preset: ScenePreset): Promise<ScenePreset>
  publish(id: string, version: number): Promise<PublishResult<ScenePreset>>
  archive(id: string, version: number): Promise<void>
}

const DEFAULT_PRODUCT_SPEC_ID = 'generic-effect-product-spec'
const DEFAULT_TARGET_SUBTYPES: EffectSubtype[] = ['plain']
const LEGACY_SCENES_DIR = path.join(process.cwd(), 'data', 'scenes')
const SCENE_PRESETS_DIR = path.join(process.cwd(), 'data', 'scene-presets')
const STUDIO_DOCUMENTS_DIR = path.join(process.cwd(), 'data', 'studio-documents')

function sanitizeStudioSlug(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
}

function versionedPresetPath(rootDir: string, id: string, version: number) {
  return path.join(rootDir, id, `v${version}.json`)
}

function studioDocumentPath(rootDir: string, slug: string) {
  return path.join(rootDir, `${slug}.json`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isScenePreset(value: unknown): value is ScenePreset {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.version === 'number' &&
    (value.status === 'draft' || value.status === 'published' || value.status === 'archived') &&
    value.family === 'effect' &&
    typeof value.product_spec_id === 'string' &&
    isRecord(value.payload)
  )
}

function isStoredStudioDocument(value: unknown): value is StoredStudioDocument {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    typeof value.product_spec_id === 'string' &&
    Array.isArray(value.target_subtypes) &&
    typeof value.latest_saved_version === 'number' &&
    (value.latest_draft_version === null || typeof value.latest_draft_version === 'number') &&
    (value.published_version === null || typeof value.published_version === 'number') &&
    Array.isArray(value.archived_versions) &&
    isRecord(value.studio_state) &&
    typeof value.updated_at === 'string'
  )
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T
  } catch {
    return null
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
}

export class FileScenePresetRepository implements ScenePresetRepository {
  constructor(private readonly rootDir: string = SCENE_PRESETS_DIR) {}

  async getPublishedBySlug(slug: string): Promise<ScenePreset | null> {
    const presets = await this.listAll()
    return presets.find((preset) => preset.slug === slug && preset.status === 'published') ?? null
  }

  async getByIdVersion(id: string, version: number): Promise<ScenePreset | null> {
    const value = await readJson<unknown>(versionedPresetPath(this.rootDir, id, version))
    return isScenePreset(value) ? value : null
  }

  async listDrafts(): Promise<ScenePreset[]> {
    return (await this.listAll()).filter((preset) => preset.status === 'draft')
  }

  async saveDraft(preset: ScenePreset): Promise<ScenePreset> {
    await this.writePreset(preset)
    return preset
  }

  async publish(id: string, version: number): Promise<PublishResult<ScenePreset>> {
    const source = await this.getByIdVersion(id, version)
    if (!source) {
      throw new Error(`ScenePreset not found: ${id}@${version}`)
    }

    const presets = await this.listAll()
    const previous = presets
      .filter((preset) => preset.id === id && preset.status === 'published')
      .sort((left, right) => right.version - left.version)[0]

    if (previous) {
      await this.archive(previous.id, previous.version)
    }

    const nextVersion =
      presets
        .filter((preset) => preset.id === id)
        .reduce((maxVersion, preset) => Math.max(maxVersion, preset.version), 0) + 1
    const now = new Date().toISOString()

    const published: ScenePreset = {
      ...source,
      version: nextVersion,
      status: 'published',
      updated_at: now,
      published_at: now,
      archived_at: null,
    }

    await this.writePreset(published)
    return { previous, published }
  }

  async archive(id: string, version: number): Promise<void> {
    const preset = await this.getByIdVersion(id, version)
    if (!preset) return

    await this.writePreset({
      ...preset,
      status: 'archived',
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  async listAll(): Promise<ScenePreset[]> {
    const directories = await fs.readdir(this.rootDir, { withFileTypes: true }).catch(() => [])
    const presets: ScenePreset[] = []

    for (const directory of directories) {
      if (!directory.isDirectory()) continue
      const directoryPath = path.join(this.rootDir, directory.name)
      const files = await fs.readdir(directoryPath).catch(() => [])

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const preset = await readJson<unknown>(path.join(directoryPath, file))
        if (isScenePreset(preset)) {
          presets.push(preset)
        }
      }
    }

    return presets
  }

  private async writePreset(preset: ScenePreset) {
    await writeJson(versionedPresetPath(this.rootDir, preset.id, preset.version), preset)
  }
}

export interface StudioDocumentSaveInput {
  name: string
  sceneConfig: SceneConfig
  studioState: StudioOnlyState
  productSpecId?: string
  targetSubtypes?: EffectSubtype[]
}

export class FileStudioDocumentStore {
  constructor(
    private readonly repository: ScenePresetRepository = new FileScenePresetRepository(),
    private readonly documentsDir: string = STUDIO_DOCUMENTS_DIR,
    private readonly legacyScenesDir: string = LEGACY_SCENES_DIR,
  ) {}

  async listSummaries(): Promise<StudioDocumentSummary[]> {
    await this.ensureMigratedLegacyScenes()
    const documents = await this.listMetadata()
    const loaded = await Promise.all(
      documents.map(async (metadata) => {
        const document = await this.loadDocument(metadata.slug)
        return document ? summarizeStudioDocument(document) : null
      }),
    )

    return loaded
      .filter((item): item is StudioDocumentSummary => Boolean(item))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  async listEntries() {
    return this.listSummaries()
  }

  async loadDocument(slug: string, options?: { publishedOnly?: boolean }): Promise<StudioDocument | null> {
    await this.ensureMigratedLegacyScene(slug)
    const metadata = await this.getMetadata(slug)
    if (!metadata) return null

    const version = options?.publishedOnly
      ? metadata.published_version
      : metadata.latest_draft_version ?? metadata.published_version ?? metadata.latest_saved_version

    if (!version) return null

    const preset = await this.repository.getByIdVersion(metadata.id, version)
    if (!preset) return null

    return {
      metadata,
      scene_preset: preset,
    }
  }

  async saveDraft(input: StudioDocumentSaveInput): Promise<StudioDocument> {
    const slug = sanitizeStudioSlug(input.name) || 'default'
    const existing = await this.getMetadata(slug)
    const now = new Date().toISOString()

    const metadata: StoredStudioDocument =
      existing ??
      {
        id: slug,
        slug,
        name: input.name,
        product_spec_id: input.productSpecId ?? DEFAULT_PRODUCT_SPEC_ID,
        target_subtypes: input.targetSubtypes ?? DEFAULT_TARGET_SUBTYPES,
        latest_saved_version: 0,
        latest_draft_version: null,
        published_version: null,
        archived_versions: [],
        studio_state: input.studioState,
        updated_at: now,
      }

    const version = metadata.latest_draft_version ?? metadata.latest_saved_version + 1
    const existingPreset = await this.repository.getByIdVersion(metadata.id, version)

    const preset = sceneConfigToScenePreset({
      config: { ...input.sceneConfig, name: input.name },
      id: metadata.id,
      slug: metadata.slug,
      version,
      status: 'draft',
      productSpecId: metadata.product_spec_id,
      targetSubtypes: metadata.target_subtypes,
      createdAt: existingPreset?.created_at ?? now,
      updatedAt: now,
      publishedAt: null,
      archivedAt: null,
    })

    const savedPreset = await this.repository.saveDraft(preset)
    const nextMetadata: StoredStudioDocument = {
      ...metadata,
      name: input.name,
      latest_saved_version: Math.max(metadata.latest_saved_version, savedPreset.version),
      latest_draft_version: savedPreset.version,
      studio_state: input.studioState,
      updated_at: now,
    }

    await this.saveMetadata(nextMetadata)

    return {
      metadata: nextMetadata,
      scene_preset: savedPreset,
    }
  }

  async saveSceneConfigDraft(sceneConfig: SceneConfig) {
    const document = await this.saveDraft({
      name: sceneConfig.name,
      sceneConfig,
      studioState: buildStudioOnlyState({ config: sceneConfig }),
    })

    return {
      overwritten: document.metadata.latest_saved_version > 1,
      document,
      scene: studioDocumentToSceneConfig(document),
    }
  }

  async publish(slug: string): Promise<StudioDocument | null> {
    const metadata = await this.getMetadata(slug)
    if (!metadata) return null

    const sourceVersion = metadata.latest_draft_version ?? metadata.latest_saved_version
    if (!sourceVersion) return null

    const result = await this.repository.publish(metadata.id, sourceVersion)
    const nextMetadata: StoredStudioDocument = {
      ...metadata,
      latest_saved_version: result.published.version,
      latest_draft_version: null,
      published_version: result.published.version,
      archived_versions: result.previous
        ? Array.from(new Set([...metadata.archived_versions, result.previous.version])).sort((a, b) => a - b)
        : metadata.archived_versions,
      updated_at: result.published.updated_at,
    }

    await this.saveMetadata(nextMetadata)

    return {
      metadata: nextMetadata,
      scene_preset: result.published,
    }
  }

  async publishBySlug(slug: string, _version?: number) {
    const document = await this.publish(slug)
    if (!document) return null

    return {
      document,
      scene: studioDocumentToSceneConfig(document),
    }
  }

  async archive(slug: string): Promise<StudioDocument | null> {
    const metadata = await this.getMetadata(slug)
    if (!metadata) return null

    const versionToArchive = metadata.latest_draft_version ?? metadata.published_version
    if (!versionToArchive) return null

    await this.repository.archive(metadata.id, versionToArchive)
    const archivedPreset = await this.repository.getByIdVersion(metadata.id, versionToArchive)
    if (!archivedPreset) return null

    const nextMetadata: StoredStudioDocument = {
      ...metadata,
      latest_draft_version:
        metadata.latest_draft_version === versionToArchive ? null : metadata.latest_draft_version,
      published_version:
        metadata.published_version === versionToArchive ? null : metadata.published_version,
      archived_versions: Array.from(new Set([...metadata.archived_versions, versionToArchive])).sort(
        (left, right) => left - right,
      ),
      updated_at: archivedPreset.updated_at,
    }

    await this.saveMetadata(nextMetadata)

    return {
      metadata: nextMetadata,
      scene_preset: archivedPreset,
    }
  }

  async archiveBySlug(slug: string, _version?: number) {
    const document = await this.archive(slug)
    return Boolean(document)
  }

  async ensureMigratedLegacyScenes() {
    const files = await fs.readdir(this.legacyScenesDir).catch(() => [])
    await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => this.ensureMigratedLegacyScene(file.replace(/\.json$/, ''))),
    )
  }

  async ensureMigratedLegacyScene(nameOrSlug: string) {
    const slug = sanitizeStudioSlug(nameOrSlug)
    const existing = await this.getMetadata(slug)
    if (existing) return existing

    const legacyConfig = await readJson<SceneConfig>(path.join(this.legacyScenesDir, `${slug}.json`))
    if (!legacyConfig) return null

    const now = legacyConfig.modified ?? legacyConfig.created ?? new Date().toISOString()
    const metadata: StoredStudioDocument = {
      id: slug,
      slug,
      name: legacyConfig.name ?? slug,
      product_spec_id: DEFAULT_PRODUCT_SPEC_ID,
      target_subtypes: DEFAULT_TARGET_SUBTYPES,
      latest_saved_version: 1,
      latest_draft_version: 1,
      published_version: null,
      archived_versions: [],
      studio_state: buildStudioOnlyState({ config: legacyConfig }),
      updated_at: now,
    }

    await this.repository.saveDraft(
      sceneConfigToScenePreset({
        config: legacyConfig,
        id: metadata.id,
        slug: metadata.slug,
        version: 1,
        status: 'draft',
        productSpecId: metadata.product_spec_id,
        targetSubtypes: metadata.target_subtypes,
        createdAt: legacyConfig.created ?? now,
        updatedAt: legacyConfig.modified ?? now,
      }),
    )

    await this.saveMetadata(metadata)
    return metadata
  }

  async getSceneConfig(slug: string, options?: { publishedOnly?: boolean }) {
    const document = await this.loadDocument(slug, options)
    if (!document) return null
    return {
      document,
      scene: studioDocumentToSceneConfig(document),
      summary: summarizeStudioDocument(document),
    }
  }

  private async getMetadata(slug: string): Promise<StoredStudioDocument | null> {
    const value = await readJson<unknown>(studioDocumentPath(this.documentsDir, slug))
    return isStoredStudioDocument(value) ? value : null
  }

  private async saveMetadata(metadata: StoredStudioDocument) {
    await writeJson(studioDocumentPath(this.documentsDir, metadata.slug), metadata)
  }

  private async listMetadata(): Promise<StoredStudioDocument[]> {
    const files = await fs.readdir(this.documentsDir).catch(() => [])
    const documents = await Promise.all(
      files.filter((file) => file.endsWith('.json')).map(async (file) => {
        const value = await readJson<unknown>(path.join(this.documentsDir, file))
        return isStoredStudioDocument(value) ? value : null
      }),
    )

    return documents.filter((document): document is StoredStudioDocument => Boolean(document))
  }
}

export function createFileStudioDocumentService() {
  return new FileStudioDocumentStore()
}
