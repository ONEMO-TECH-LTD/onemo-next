import type { Contour } from '@/lib/effect/types'
import {
  nearestUserSemanticRung,
  resolveUserPlan,
  semanticLadder,
  type Attachment,
  type SemanticRung,
} from '@/lib/effect/grid-user'
import { GridWorkbenchPanel, type GridWorkbenchPanelProps } from './GridWorkbenchPanel'

export const USER_DOOR_IGNORED_CONTROLS = [
  'Max auto-margin',
  'Density',
  'Grid pitch',
  'Magnet padding',
  'Base margin',
  'Grid pattern',
  'Grid centering',
  'Magnet plan',
] as const

export function resolveUserWorkbenchPlan(contourMM: Contour, attachment: Attachment) {
  return resolveUserPlan(contourMM, { attachment })
}

export function resolveUserWorkbenchLadder(makeShape: (sizeMM: number) => Contour): SemanticRung[] {
  return semanticLadder(makeShape)
}

export function nearestUserWorkbenchRung(
  rungs: ReadonlyArray<SemanticRung>,
  targetMM: number,
): SemanticRung {
  return nearestUserSemanticRung(rungs, targetMM)
}

/** Full original-panel clone. Control stay/go decisions remain Dan-gated. */
export function GridWorkbenchUserPanel(props: GridWorkbenchPanelProps) {
  return (
    <div className="gl-panel-stack" data-workbench-panel="user">
      <GridWorkbenchPanel {...props} />
    </div>
  )
}
