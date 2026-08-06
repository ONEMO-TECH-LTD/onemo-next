// cutout-lab — control-surface config DATA (tabs → chips → knob ranges). Data only, no logic:
// the shell renders from this; adding a knob = one entry here.

export type Tool = 'add' | 'erase' | 'draw' | 'draw-erase' | 'nodes' | 'frame'
export type Tab = 'ai' | 'vector' | 'blend' | 'edit'

export const VEC_CHIPS = ['detail', 'offset', 'simplify', 'smooth', 'straighten', 'radius', 'curve'] as const
export const BLEND_CHIPS = ['blend', 'vignette', 'scale', 'panX', 'panY'] as const

export const CHIP_RANGE: Record<string, [number, number]> = {
  detail: [0, 100], offset: [0, 15], simplify: [0, 100], smooth: [0, 100], straighten: [0, 100],
  radius: [0, 100], curve: [0, 100], blend: [0, 100], vignette: [0, 100], scale: [25, 300], panX: [-50, 50], panY: [-50, 50],
}
