import {
  nearestUserSemanticRung,
  type SemanticRung,
} from '@/lib/effect/grid-user'
import {
  cachedUserGridJob,
  prewarmUserCanonicalShapes,
  requestUserGridJob,
  userGridJobKey,
} from '@/lib/effect/grid-user-client'
import { GridWorkbenchPanel, type GridWorkbenchPanelProps } from './GridWorkbenchPanel'

export {
  cachedUserGridJob,
  prewarmUserCanonicalShapes,
  requestUserGridJob,
  userGridJobKey,
}
export type { UserGridJob, UserGridJobResult, UserStandardShape } from '@/lib/effect/grid-user'

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
