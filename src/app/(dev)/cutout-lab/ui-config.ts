import { NODE_KNOB_MAX } from '@/lib/vector-edit'

// cutout-lab — control-surface config DATA (tabs → chips → knob ranges). Data only, no logic:
// the shell renders from this; adding a knob = one entry here.

export type Tool = 'add' | 'erase' | 'draw' | 'draw-erase' | 'nodes' | 'frame' // I2f: wand tool modes DELETED — the wand is a DRIVER of the one brush
export type Tab = 'ai' | 'vector' | 'blend' | 'edit'

export const VEC_CHIPS = ['detail', 'offset', 'simplify', 'smooth', 'radius'] as const // straighten + curve dropped from the surface (Dan 2026-08-06) — engine keeps both
export const BLEND_CHIPS = ['blend'] as const // vignette/presets/tint + scale/pan removed from the surface (Dan 2026-08-06) — engine keeps them

export const CHIP_RANGE: Record<string, [number, number]> = {
  detail: [0, 100], offset: [0, 15], simplify: [0, 100], smooth: [0, 200], straighten: [0, 100],
  radius: [0, 100], curve: [0, 100], blend: [0, 100], vignette: [0, 100], scale: [25, 300], panX: [-50, 50], panY: [-50, 50],
  nodeRadius: [0, NODE_KNOB_MAX.radius], nodeCurve: [0, NODE_KNOB_MAX.curve], // per-node knobs — scale owned by vector-edit
}
