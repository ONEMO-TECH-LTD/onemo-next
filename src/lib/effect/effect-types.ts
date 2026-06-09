// effect-types.ts — the effect-type registry (canonical ONEMO taxonomy carried as DATA).
//
// Effect TYPE is data, NEVER hard-coded into symbol names (scalability rule): a new effect type is a
// new entry here, not a rename across the codebase. Canonical ONEMO taxonomy
// (scope-lock 2.1 / catalog 2.4): Tier-1 "Standard Effect" = fixed-geometry shapes (the ONEMO square
// + other predefined shapes); Tier-2 "Shaped Effect" = free-form, contour-defined silhouette.

export const EFFECT_TYPES = {
  standard: { id: 'standard', label: 'Standard Effect', tier: 1 },
  shaped: { id: 'shaped', label: 'Shaped Effect', tier: 2 },
} as const

export type EffectType = keyof typeof EFFECT_TYPES
