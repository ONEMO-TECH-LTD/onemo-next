import type { Dispatch, SetStateAction } from 'react'
import type { TexturePaths } from '@/app/(dev)/prototype/types'
import type { ViewerConfig } from '@/app/(dev)/prototype/types'
import type { StudioControlRegistry, StudioField, StudioOption, StudioTab } from './types'

type MaterialKey = 'face' | 'back' | 'frame'

interface EffectRegistryLayoutContext {
  showLeftDock: boolean
  showRightDock: boolean
  selectedLayoutPreset: string
  layoutPresetOptions: StudioOption[]
  setShowLeftDock: (value: boolean) => void
  setShowRightDock: (value: boolean) => void
  onSelectLayoutPreset: (value: string) => void
}

interface EffectRegistryContext {
  getConfig: () => ViewerConfig
  setConfig: Dispatch<SetStateAction<ViewerConfig>>
  currentScene: string
  sceneDraftName: string
  setSceneDraftName: (value: string) => void
  sceneOptions: StudioOption[]
  modelOptions: StudioOption[]
  hdriOptions: StudioOption[]
  onLoadScene: (name: string) => Promise<void> | void
  onSaveScene: (name: string) => Promise<void> | void
  onResetScene: () => void
  onTextureUpload?: (material: MaterialKey, slot: keyof TexturePaths, file: File) => Promise<void> | void
  onAssetUpload?: (type: 'shapes' | 'env', file: File) => Promise<void> | void
  layout?: EffectRegistryLayoutContext
}

function pickFile(accept: string[], onFile: (file: File) => Promise<void> | void): () => Promise<void> {
  return () =>
    new Promise<void>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept.join(',')
      input.onchange = async () => {
        const file = input.files?.[0]
        if (file) await onFile(file)
        resolve()
      }
      input.click()
    })
}

function currentEnvironmentValue(config: ViewerConfig) {
  return config.environment?.customHdri ?? config.environment?.preset ?? 'studio'
}

function getLightValue(ctx: EffectRegistryContext, key: 'key' | 'fill' | 'rim') {
  return ctx.getConfig().lighting?.[key]
}

function updateLight(
  ctx: EffectRegistryContext,
  key: 'key' | 'fill' | 'rim',
  patch: Partial<NonNullable<ViewerConfig['lighting']>['key']>,
) {
  ctx.setConfig((prev) => ({
    ...prev,
    lighting: {
      ...prev.lighting!,
      [key]: {
        ...prev.lighting![key],
        ...patch,
      },
    },
  }))
}

function buildInspectorTabs(ctx: EffectRegistryContext): StudioTab[] {
  const tabs: StudioTab[] = [
    {
      id: 'scene',
      title: 'Scene',
      sections: [
        {
          id: 'model',
          title: 'Model',
          defaultExpanded: true,
          fields: [
            {
              kind: 'select',
              path: 'scene.modelPath',
              label: 'Active Model',
              options: ctx.modelOptions,
              get: () => ctx.getConfig().modelPath,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                modelPath: value,
              })),
            },
          ],
        },
      ],
    },
    {
      id: 'materials',
      title: 'Materials',
      sections: [
        {
          id: 'face',
          title: 'Face',
          defaultExpanded: true,
          fields: [
            {
              kind: 'number',
              path: 'materials.face.roughness',
              label: 'Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().face.params.roughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, roughness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.metalness',
              label: 'Metalness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().face.params.metalness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, metalness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.envMapIntensity',
              label: 'Env Intensity',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().face.params.envMapIntensity,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, envMapIntensity: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.normalScale',
              label: 'Normal Scale',
              min: 0,
              max: 2,
              step: 0.01,
              get: () => ctx.getConfig().face.params.normalScale,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, normalScale: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.bumpScale',
              label: 'Height Scale',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().face.params.bumpScale,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, bumpScale: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.sheen',
              label: 'Sheen',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().face.params.sheen,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, sheen: value } },
              })),
            },
            {
              kind: 'color',
              path: 'materials.face.sheenColor',
              label: 'Sheen Color',
              get: () => ctx.getConfig().face.params.sheenColor,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, sheenColor: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.sheenRoughness',
              label: 'Sheen Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().face.params.sheenRoughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, sheenRoughness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.face.colorMultiplier',
              label: 'Color Gain',
              min: 0,
              max: 2,
              step: 0.01,
              get: () => ctx.getConfig().face.params.colorMultiplier,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                face: { ...prev.face, params: { ...prev.face.params, colorMultiplier: value } },
              })),
            },
            {
              kind: 'file',
              path: 'materials.face.textures.texture',
              label: 'Artwork Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().face.textures.texture ?? 'Runtime artwork',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('face', 'texture', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.face.textures.normal',
              label: 'Normal Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().face.textures.normal,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('face', 'normal', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.face.textures.roughness',
              label: 'Roughness Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().face.textures.roughness,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('face', 'roughness', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.face.textures.height',
              label: 'Height Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().face.textures.height,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('face', 'height', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.face.textures.sheenColor',
              label: 'Sheen Color Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().face.textures.sheenColor ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('face', 'sheenColor', f)) }
                : {}),
            },
          ],
        },
        {
          id: 'back',
          title: 'Back',
          fields: [
            {
              kind: 'color',
              path: 'materials.back.color',
              label: 'Color',
              get: () => ctx.getConfig().back.params.color,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, color: value } },
                colors: { ...prev.colors, backColor: value },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.roughness',
              label: 'Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().back.params.roughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, roughness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.envMapIntensity',
              label: 'Env Intensity',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().back.params.envMapIntensity,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, envMapIntensity: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.normalScale',
              label: 'Normal Scale',
              min: 0,
              max: 2,
              step: 0.01,
              get: () => ctx.getConfig().back.params.normalScale,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, normalScale: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.bumpScale',
              label: 'Height Scale',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().back.params.bumpScale,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, bumpScale: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.sheen',
              label: 'Sheen',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().back.params.sheen,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, sheen: value } },
              })),
            },
            {
              kind: 'color',
              path: 'materials.back.sheenColor',
              label: 'Sheen Color',
              get: () => ctx.getConfig().back.params.sheenColor,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, sheenColor: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.back.sheenRoughness',
              label: 'Sheen Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().back.params.sheenRoughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                back: { ...prev.back, params: { ...prev.back.params, sheenRoughness: value } },
              })),
            },
            {
              kind: 'file',
              path: 'materials.back.textures.texture',
              label: 'Color Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().back.textures.texture ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('back', 'texture', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.back.textures.normal',
              label: 'Normal Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().back.textures.normal,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('back', 'normal', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.back.textures.roughness',
              label: 'Roughness Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().back.textures.roughness,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('back', 'roughness', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.back.textures.height',
              label: 'Height Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().back.textures.height,
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('back', 'height', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.back.textures.sheenColor',
              label: 'Sheen Color Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().back.textures.sheenColor ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('back', 'sheenColor', f)) }
                : {}),
            },
          ],
        },
        {
          id: 'frame',
          title: 'Frame',
          fields: [
            {
              kind: 'color',
              path: 'materials.frame.color',
              label: 'Color',
              get: () => ctx.getConfig().frame.params.color,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                frame: { ...prev.frame, params: { ...prev.frame.params, color: value } },
                colors: { ...prev.colors, frameColor: value },
              })),
            },
            {
              kind: 'number',
              path: 'materials.frame.roughness',
              label: 'Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().frame.params.roughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                frame: { ...prev.frame, params: { ...prev.frame.params, roughness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.frame.metalness',
              label: 'Metalness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().frame.params.metalness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                frame: { ...prev.frame, params: { ...prev.frame.params, metalness: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.frame.clearcoat',
              label: 'Clearcoat',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().frame.params.clearcoat,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                frame: { ...prev.frame, params: { ...prev.frame.params, clearcoat: value } },
              })),
            },
            {
              kind: 'number',
              path: 'materials.frame.clearcoatRoughness',
              label: 'Clearcoat Roughness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().frame.params.clearcoatRoughness,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                frame: { ...prev.frame, params: { ...prev.frame.params, clearcoatRoughness: value } },
              })),
            },
            {
              kind: 'file',
              path: 'materials.frame.textures.texture',
              label: 'Color Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('frame', 'texture', f)) }
                : {}),
              currentValue: () => ctx.getConfig().frame.textures.texture ?? 'Not assigned',
            },
            {
              kind: 'file',
              path: 'materials.frame.textures.normal',
              label: 'Normal Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().frame.textures.normal ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('frame', 'normal', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.frame.textures.roughness',
              label: 'Roughness Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().frame.textures.roughness ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('frame', 'roughness', f)) }
                : {}),
            },
            {
              kind: 'file',
              path: 'materials.frame.textures.height',
              label: 'Height Map',
              accept: ['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'],
              currentValue: () => ctx.getConfig().frame.textures.height ?? 'Not assigned',
              ...(ctx.onTextureUpload
                ? { pick: pickFile(['.png', '.jpg', '.jpeg', '.webp', '.avif', 'image/*'], (f) => ctx.onTextureUpload!('frame', 'height', f)) }
                : {}),
            },
          ],
        },
      ],
    },
    {
      id: 'environment',
      title: 'Environment',
      sections: [
        {
          id: 'source',
          title: 'Source',
          defaultExpanded: true,
          fields: [
            {
              kind: 'select',
              path: 'environment.source',
              label: 'HDRI',
              options: ctx.hdriOptions,
              get: () => currentEnvironmentValue(ctx.getConfig()),
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                environment: {
                  ...prev.environment!,
                  preset: value.startsWith('/assets/') ? 'studio' : value,
                  customHdri: value.startsWith('/assets/') ? value : undefined,
                },
              })),
            },
            {
              kind: 'file',
              path: 'environment.customHdri',
              label: 'HDRI Asset',
              accept: ['.hdr', '.exr', 'image/vnd.radiance', 'image/exr'],
              currentValue: () => ctx.getConfig().environment?.customHdri ?? ctx.getConfig().environment?.preset ?? 'studio',
            },
          ],
        },
        {
          id: 'mapping',
          title: 'Mapping',
          fields: [
            {
              kind: 'number',
              path: 'environment.envRotation',
              label: 'Rotation',
              min: -180,
              max: 180,
              step: 1,
              get: () => ctx.getConfig().environment?.envRotation ?? 0,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                environment: { ...prev.environment!, envRotation: value },
              })),
            },
          ],
        },
        {
          id: 'ground',
          title: 'Ground',
          fields: [
            {
              kind: 'boolean',
              path: 'environment.groundEnabled',
              label: 'Enabled',
              get: () => ctx.getConfig().environment?.groundEnabled ?? false,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                environment: { ...prev.environment!, groundEnabled: value },
              })),
            },
            {
              kind: 'number',
              path: 'environment.groundHeight',
              label: 'Height',
              min: -5,
              max: 5,
              step: 0.01,
              get: () => ctx.getConfig().environment?.groundHeight ?? 0,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                environment: { ...prev.environment!, groundHeight: value },
              })),
            },
            {
              kind: 'number',
              path: 'environment.groundRadius',
              label: 'Radius',
              min: 0,
              max: 100,
              step: 0.1,
              get: () => ctx.getConfig().environment?.groundRadius ?? 20,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                environment: { ...prev.environment!, groundRadius: value },
              })),
            },
          ],
        },
      ],
    },
    {
      id: 'lights',
      title: 'Lights',
      sections: (['key', 'fill', 'rim'] as const).map((lightKey) => ({
        id: `light-${lightKey}`,
        title: `${lightKey[0].toUpperCase()}${lightKey.slice(1)} Light`,
        fields: [
          {
            kind: 'select',
            path: `lighting.${lightKey}.type`,
            label: 'Type',
            options: [
              { label: 'Directional', value: 'directional' },
              { label: 'Point', value: 'point' },
              { label: 'Spot', value: 'spot' },
            ],
            get: () => getLightValue(ctx, lightKey)?.type ?? 'directional',
            set: (value) => updateLight(ctx, lightKey, { type: value as 'directional' | 'point' | 'spot' }),
          },
          {
            kind: 'boolean',
            path: `lighting.${lightKey}.enabled`,
            label: 'Enabled',
            get: () => Boolean(getLightValue(ctx, lightKey)?.enabled),
            set: (value) => updateLight(ctx, lightKey, { enabled: value }),
          },
          {
            kind: 'number',
            path: `lighting.${lightKey}.intensity`,
            label: 'Intensity',
            min: 0,
            max: 4,
            step: 0.01,
            get: () => getLightValue(ctx, lightKey)?.intensity ?? 0,
            set: (value) => updateLight(ctx, lightKey, { intensity: value }),
          },
          {
            kind: 'color',
            path: `lighting.${lightKey}.color`,
            label: 'Color',
            get: () => getLightValue(ctx, lightKey)?.color ?? '#ffffff',
            set: (value) => updateLight(ctx, lightKey, { color: value }),
          },
          {
            kind: 'vec3',
            path: `lighting.${lightKey}.position`,
            label: 'Position',
            min: -5,
            max: 5,
            step: 0.01,
            get: () => {
              const l = getLightValue(ctx, lightKey)
              return { x: l?.x ?? 0, y: l?.y ?? 0, z: l?.z ?? 0 }
            },
            set: ({ x, y, z }) => updateLight(ctx, lightKey, { x, y, z }),
          },
          {
            kind: 'vec3',
            path: `lighting.${lightKey}.target`,
            label: 'Target',
            min: -5,
            max: 5,
            step: 0.01,
            get: () => {
              const l = getLightValue(ctx, lightKey)
              return { x: l?.targetX ?? 0, y: l?.targetY ?? 0, z: l?.targetZ ?? 0 }
            },
            set: ({ x, y, z }) => updateLight(ctx, lightKey, { targetX: x, targetY: y, targetZ: z }),
          },
        ] as StudioField[],
      })),
    },
    {
      id: 'camera',
      title: 'Camera',
      sections: [
        {
          id: 'lens',
          title: 'Lens',
          defaultExpanded: true,
          fields: [
            {
              kind: 'number',
              path: 'camera.fov',
              label: 'FOV',
              min: 10,
              max: 120,
              step: 1,
              get: () => ctx.getConfig().camera?.fov ?? 35,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, fov: value },
              })),
            },
            {
              kind: 'number',
              path: 'camera.distance',
              label: 'Distance',
              min: 0.05,
              max: 5,
              step: 0.01,
              get: () => ctx.getConfig().camera?.distance ?? 0.2,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, distance: value },
              })),
            },
          ],
        },
        {
          id: 'orbit',
          title: 'Orbit',
          fields: [
            {
              kind: 'number',
              path: 'camera.polarAngle',
              label: 'Polar',
              min: 0,
              max: 180,
              step: 1,
              get: () => ctx.getConfig().camera?.polarAngle ?? 90,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, polarAngle: value },
              })),
            },
            {
              kind: 'number',
              path: 'camera.azimuthAngle',
              label: 'Azimuth',
              min: -180,
              max: 180,
              step: 1,
              get: () => ctx.getConfig().camera?.azimuthAngle ?? 0,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, azimuthAngle: value },
              })),
            },
            {
              kind: 'boolean',
              path: 'camera.enableDamping',
              label: 'Damping',
              get: () => ctx.getConfig().camera?.enableDamping ?? true,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, enableDamping: value },
              })),
            },
            {
              kind: 'number',
              path: 'camera.dampingFactor',
              label: 'Damping Factor',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().camera?.dampingFactor ?? 0.1,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, dampingFactor: value },
              })),
            },
            {
              kind: 'boolean',
              path: 'camera.autoRotate',
              label: 'Auto Rotate',
              get: () => ctx.getConfig().camera?.autoRotate ?? false,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, autoRotate: value },
              })),
            },
            {
              kind: 'number',
              path: 'camera.autoRotateSpeed',
              label: 'Rotate Speed',
              min: -10,
              max: 10,
              step: 0.1,
              get: () => ctx.getConfig().camera?.autoRotateSpeed ?? 2,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                camera: { ...prev.camera!, autoRotateSpeed: value },
              })),
            },
          ],
        },
      ],
    },
    {
      id: 'image',
      title: 'Image',
      sections: [
        {
          id: 'rendering',
          title: 'Rendering',
          defaultExpanded: true,
          fields: [
            {
              kind: 'number',
              path: 'scene.exposure',
              label: 'Exposure',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().scene.exposure,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, exposure: value },
              })),
            },
            {
              kind: 'number',
              path: 'scene.ambientIntensity',
              label: 'Ambient',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().scene.ambientIntensity,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, ambientIntensity: value },
              })),
            },
            {
              kind: 'number',
              path: 'scene.envIntensity',
              label: 'Environment Intensity',
              min: 0,
              max: 4,
              step: 0.01,
              get: () => ctx.getConfig().scene.envIntensity,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, envIntensity: value },
              })),
            },
            {
              kind: 'color',
              path: 'scene.background',
              label: 'Background',
              get: () => ctx.getConfig().colors.bgColor,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, background: value },
                colors: { ...prev.colors, bgColor: value },
              })),
            },
            {
              kind: 'boolean',
              path: 'scene.transparentBackground',
              label: 'Transparent Background',
              get: () => ctx.getConfig().scene.transparentBackground ?? false,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, transparentBackground: value },
              })),
            },
            {
              kind: 'boolean',
              path: 'scene.shadowEnabled',
              label: 'Ground Shadows',
              get: () => ctx.getConfig().scene.shadowEnabled ?? true,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: { ...prev.scene, shadowEnabled: value },
              })),
            },
            {
              kind: 'number',
              path: 'scene.dprMin',
              label: 'DPR Min',
              min: 0.5,
              max: 4,
              step: 0.1,
              get: () => ctx.getConfig().scene.dprMin ?? 1,
              set: (value) => ctx.setConfig((prev) => {
                const nextMin = Math.max(0.5, Math.min(4, value))
                const nextMax = Math.max(nextMin, prev.scene.dprMax ?? 2)
                return {
                  ...prev,
                  scene: {
                    ...prev.scene,
                    dprMin: nextMin,
                    dprMax: nextMax,
                  },
                }
              }),
            },
            {
              kind: 'number',
              path: 'scene.dprMax',
              label: 'DPR Max',
              min: 0.5,
              max: 4,
              step: 0.1,
              get: () => ctx.getConfig().scene.dprMax ?? 2,
              set: (value) => ctx.setConfig((prev) => {
                const nextMin = prev.scene.dprMin ?? 1
                const nextMax = Math.max(nextMin, Math.min(4, value))
                return {
                  ...prev,
                  scene: {
                    ...prev.scene,
                    dprMax: nextMax,
                  },
                }
              }),
            },
            {
              kind: 'select',
              path: 'scene.frameloop',
              label: 'Frame Loop',
              options: [
                { label: 'Always', value: 'always' },
                { label: 'Demand', value: 'demand' },
              ],
              get: () => ctx.getConfig().scene.frameloop ?? 'always',
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                scene: {
                  ...prev.scene,
                  frameloop: value === 'demand' ? 'demand' : 'always',
                },
              })),
            },
          ],
        },
        {
          id: 'postfx',
          title: 'Post FX',
          fields: [
            {
              kind: 'boolean',
              path: 'postprocessing.bloomEnabled',
              label: 'Bloom',
              get: () => ctx.getConfig().postprocessing?.bloomEnabled ?? false,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, bloomEnabled: value },
              })),
            },
            {
              kind: 'number',
              path: 'postprocessing.bloomIntensity',
              label: 'Bloom Intensity',
              min: 0,
              max: 3,
              step: 0.01,
              get: () => ctx.getConfig().postprocessing?.bloomIntensity ?? 0.35,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, bloomIntensity: value },
              })),
            },
            {
              kind: 'number',
              path: 'postprocessing.bloomLuminanceThreshold',
              label: 'Bloom Threshold',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().postprocessing?.bloomLuminanceThreshold ?? 0.7,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, bloomLuminanceThreshold: value },
              })),
            },
            {
              kind: 'number',
              path: 'postprocessing.bloomRadius',
              label: 'Bloom Radius',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().postprocessing?.bloomRadius ?? 0.85,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, bloomRadius: value },
              })),
            },
            {
              kind: 'boolean',
              path: 'postprocessing.vignetteEnabled',
              label: 'Vignette',
              get: () => ctx.getConfig().postprocessing?.vignetteEnabled ?? false,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, vignetteEnabled: value },
              })),
            },
            {
              kind: 'number',
              path: 'postprocessing.vignetteOffset',
              label: 'Vignette Offset',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().postprocessing?.vignetteOffset ?? 0.35,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, vignetteOffset: value },
              })),
            },
            {
              kind: 'number',
              path: 'postprocessing.vignetteDarkness',
              label: 'Vignette Darkness',
              min: 0,
              max: 1,
              step: 0.01,
              get: () => ctx.getConfig().postprocessing?.vignetteDarkness ?? 0.55,
              set: (value) => ctx.setConfig((prev) => ({
                ...prev,
                postprocessing: { ...prev.postprocessing!, vignetteDarkness: value },
              })),
            },
          ],
        },
      ],
    },
  ]

  return tabs
}

export function createEffectStudioRegistry(ctx: EffectRegistryContext): StudioControlRegistry {
  return {
    id: 'effect-standard-inspector',
    title: 'Inspector',
    tabs: buildInspectorTabs(ctx),
  }
}
