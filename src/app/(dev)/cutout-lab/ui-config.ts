import { NODE_KNOB_MAX } from '@/lib/vector-edit'

// cutout-lab — control-surface config DATA (tabs → chips → knob ranges). Data only, no logic:
// the shell renders from this; adding a knob = one entry here.

export type Tool = 'add' | 'erase' | 'draw' | 'draw-erase' | 'nodes' | 'frame' // I2f: wand tool modes DELETED — the wand is a DRIVER of the one brush
export type Tab = 'ai' | 'vector' | 'blend' | 'edit'

export const VEC_CHIPS = ['detail', 'offset', 'simplify', 'smooth', 'radius'] as const // straighten + curve dropped from the surface (Dan 2026-08-06) — engine keeps both
export const BLEND_CHIPS = ['blend'] as const

export const LEGACY_VEC_RANGE: Record<(typeof VEC_CHIPS)[number], [number, number]> = {
  detail: [0, 100], offset: [0, 15], simplify: [0, 100], smooth: [0, 200], radius: [0, 100],
}

export const CHIP_RANGE: Record<string, [number, number]> = {
  detail: [0, 150], offset: [0, 160], simplify: [0, 30], smooth: [0, 200], straighten: [0, 100],
  radius: [0, 260], curve: [0, 100], blend: [0, 100],
  nodeRadius: [0, NODE_KNOB_MAX.radius], nodeCurve: [0, NODE_KNOB_MAX.curve], // per-node knobs — scale owned by vector-edit
}
