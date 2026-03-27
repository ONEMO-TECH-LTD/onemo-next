export type StudioScalar = string | number | boolean

export interface StudioOption {
  label: string
  value: string
  previewUrl?: string
}

interface StudioFieldBase {
  kind: string
  path: string
  label: string
  description?: string
}

export interface StudioNumberField extends StudioFieldBase {
  kind: 'number'
  min?: number
  max?: number
  step?: number
  get: () => number
  set: (value: number) => void
}

export interface StudioTextField extends StudioFieldBase {
  kind: 'text'
  get: () => string
  set: (value: string) => void
}

export interface StudioColorField extends StudioFieldBase {
  kind: 'color'
  get: () => string
  set: (value: string) => void
}

export interface StudioBooleanField extends StudioFieldBase {
  kind: 'boolean'
  get: () => boolean
  set: (value: boolean) => void
}

export interface StudioSelectField extends StudioFieldBase {
  kind: 'select'
  options: StudioOption[]
  get: () => string
  set: (value: string) => void
}

export interface StudioFileField extends StudioFieldBase {
  kind: 'file'
  accept: string[]
  currentValue?: () => string
  buttonTitle?: string
  pick?: () => Promise<void> | void
}

export interface StudioActionField extends StudioFieldBase {
  kind: 'action'
  buttonTitle?: string
  run: () => Promise<void> | void
}

export interface StudioVec3Field extends StudioFieldBase {
  kind: 'vec3'
  min?: number
  max?: number
  step?: number
  get: () => { x: number; y: number; z: number }
  set: (value: { x: number; y: number; z: number }) => void
}

export type StudioField =
  | StudioNumberField
  | StudioTextField
  | StudioColorField
  | StudioBooleanField
  | StudioSelectField
  | StudioFileField
  | StudioActionField
  | StudioVec3Field

export interface StudioSection {
  id: string
  title: string
  description?: string
  defaultExpanded?: boolean
  fields: StudioField[]
}

export interface StudioTab {
  id: string
  title: string
  description?: string
  sections: StudioSection[]
}

export interface StudioControlRegistry {
  id: string
  title: string
  tabs: StudioTab[]
}
