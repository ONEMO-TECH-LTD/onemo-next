'use client'

// ShapedModelBridge — the editor↔3D BRIDGE half (R7 — Creator v5).
//
// "Bridge translates, viewer renders." This thin wrapper is the TRANSLATE half: it subscribes to the
// outlineStore (the documented two-way editor↔3D bridge) and hands the resolved geometry + live edit
// signals to the prop-pure <ShapedModel> (the RENDER half). Keeping the subscriptions HERE — local to
// the 3D subtree, not lifted to the page — preserves the golden scene's tight re-render granularity
// while letting ShapedModel render from props alone (swap-test; North Star module 8 prop-purity).

import { useOutlineStore } from '../../user/outlineStore'
import ShapedModel from './ShapedModel'
import type { DesignState, SceneSettings } from '../../types'
import type { SuedeMaterialParams } from '@/lib/effect/types'
import type { PreparedEffect } from '@/lib/effect/prepare-effect'

interface ShapedModelBridgeProps {
  prepared: PreparedEffect
  designState: DesignState
  scene: SceneSettings
  suede: SuedeMaterialParams
  backColor: string
  fitSize?: number
  onStatus?: (status: 'idle' | 'building' | 'ready' | 'error', message?: string) => void
}

export default function ShapedModelBridge(props: ShapedModelBridgeProps) {
  const committedShape = useOutlineStore((s) => s.committedShape)
  const committedContourMM = useOutlineStore((s) => s.committedContourMM)
  const editorOpen = useOutlineStore((s) => s.editorOpen)
  const bgBlur = useOutlineStore((s) => s.bgBlur)
  const imageFx = useOutlineStore((s) => s.imageFx)
  return (
    <ShapedModel
      {...props}
      committedShape={committedShape}
      committedContourMM={committedContourMM}
      editorOpen={editorOpen}
      bgBlur={bgBlur}
      imageFx={imageFx}
    />
  )
}
