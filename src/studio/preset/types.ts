import type { MaterialPresetConfig } from '@/app/(dev)/prototype/types'
import type { ScenePreset } from '@/studio/persistence/studioDocument'

export type StudioPreset = ScenePreset

export interface StudioPresetSummary {
  id: string
  name: string
  created: string
  modified: string
  modelPath: string
  environmentLabel: string
  hasArtwork: boolean
  enabledLights: number
  postprocessingEnabled: boolean
  faceTextureCount: number
  backTextureCount: number
  frameTextureCount: number
}

export interface StudioMaterialPresetSummary {
  name: string
  modified: string
  faceTextureCount: number
  backTextureCount: number
  frameTextureCount: number
}

export interface StudioOutputPayload {
  generatedAt: string
  activeStudio: StudioPresetSummary | null
  studios: StudioPresetSummary[]
  materialPresets: StudioMaterialPresetSummary[]
  selectedStudio: StudioPreset | null
  selectedMaterialPreset: MaterialPresetConfig | null
}
