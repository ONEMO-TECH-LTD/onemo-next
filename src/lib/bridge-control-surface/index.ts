// vector-controls — Dan priority 3: the v1 vector control surface as DATA + policy (tabs → chips →
// knob ranges, detail inversion, the offset-outgrowth behavior). The adopting shell renders from
// this and drives the BRIDGE's own descriptor session (previewTool/commitTool) — this module never
// resolves an outline itself. Verbatim from v1 ui-config + the value-true auto-blend policy.

import { NODE_KNOB_MAX } from '@/lib/tool-node-math'
import { outgrown, type Bounds, type BlendPolicy } from '@/lib/bridge-compose-policy'

export type Tool = 'add' | 'erase' | 'draw' | 'draw-erase' | 'nodes' | 'frame'
export type Tab = 'ai' | 'vector' | 'blend' | 'edit'

export const VEC_CHIPS = ['detail', 'offset', 'simplify', 'smooth', 'radius'] as const // straighten + curve off the surface (Dan 2026-08-06) — engine keeps both
export const BLEND_CHIPS = ['blend'] as const // vignette/presets/tint + scale/pan off the surface (Dan 2026-08-06)

export const CHIP_RANGE: Record<string, [number, number]> = {
  detail: [0, 100], offset: [0, 15], simplify: [0, 100], smooth: [0, 200], straighten: [0, 100],
  radius: [0, 100], curve: [0, 100], blend: [0, 100], vignette: [0, 100], scale: [25, 300], panX: [-50, 50], panY: [-50, 50],
  nodeRadius: [0, NODE_KNOB_MAX.radius], nodeCurve: [0, NODE_KNOB_MAX.curve],
}

/** Dan's default config for ANY shape (2026-08-06): offset 3, the rest 10; detail UI-INVERTED. */
export const AUTO_KNOBS = { detail: 10, offset: 3, simplify: 10, smooth: 10, radius: 10 } as const

/** Detail is UI-inverted: knob 0 = full fidelity (engine 100). ONE mapping, both directions. */
export const detailKnobToEngine = (knob: number): number => CHIP_RANGE.detail[1] - knob
export const detailEngineToKnob = (engine: number): number => CHIP_RANGE.detail[1] - engine

/** AUTO-COMPOSITING ON FRAME EXIT (Dan's law), VALUE-TRUE: entering outgrowth with blend 0 sets
 *  the actual blend knob to the engine default — the control reflects what is applied; the user's
 *  re-zero stands until the NEXT transition into outgrowth. Pure decision; the caller applies. */
export function autoBlendOnOutgrowth(
  bounds: Bounds | null, imgW: number, imgH: number,
  wasOutgrown: boolean, blend: BlendPolicy, engineDefaultBlend: number,
): { nowOutgrown: boolean; setBlendTo: number | null } {
  const nowOutgrown = !!bounds && outgrown(bounds, imgW, imgH)
  const setBlendTo = nowOutgrown && !wasOutgrown && blend.blend === 0 ? Math.round(engineDefaultBlend) : null
  return { nowOutgrown, setBlendTo }
}
