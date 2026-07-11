import type { RootKind } from './authoring-types'

const PROJECT_AUTHORING_ROOT = 'src/app/(dev)/react-figma-components'

export function authoringMetadataPath(kind: RootKind, suffix: string): string {
  return kind === 'global'
    ? `.onemo/${suffix}`
    : `${PROJECT_AUTHORING_ROOT}/.onemo/${suffix}`
}
