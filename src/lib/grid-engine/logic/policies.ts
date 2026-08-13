// LOGIC — the policies. Every rule that is not physics lives here and nowhere else.
//
// Two laws govern this file, both Dan's (2026-08-12):
//
//   1. "Any policy must have a switch on/off and input if it is value based" — every entry below
//      carries `enabled`, and a value where the rule is value-based.
//   2. A policy ANNOTATES; it never removes. A size marked "excluded by corridor" stays in the
//      output with the mark on it, so what a rule costs is seen empirically instead of argued.
//
// All default OFF. With every switch off the annotated output IS the pure engine's output — that
// identity is pinned by `__tests__/policies.test.ts` and is the property that makes "identify
// what must be discarded empirically" possible.
//
// Every judgement here reads FACTS the engine reported (held flags, link facts, overhang numbers,
// residues of published coordinates). No policy performs geometry: if a rule needs a geometric
// fact the engine does not report, the engine grows the fact — the rule never computes it.

import type { MeasuredVariant } from '../engine/measure'

export type PolicyId =
  | 'minimumMagnets'
  | 'bandSpan'
  | 'corridor'
  | 'sparseEngagement'
  | 'flapLimit'

export interface PolicyDefinition {
  readonly id: PolicyId
  readonly label: string
  /** What the rule asserts, in the terms it was originally written in. */
  readonly says: string
  /** Its standing — who ruled it, or the evidence against it being a gate. */
  readonly note: string
  readonly value?: { readonly label: string; readonly options: readonly number[] }
}

/** The catalogue. Editing this list is a product decision, not an implementation one. */
export const POLICIES: readonly PolicyDefinition[] = [
  {
    id: 'minimumMagnets',
    label: 'Minimum magnets',
    says: 'A size only counts when at least this many magnets are held.',
    note: "Dan, 2026-08-12: the minimum measure is 1 — a triangle's top corner takes one disc.",
    value: { label: 'magnets', options: [1, 2, 3, 4] },
  },
  {
    id: 'bandSpan',
    label: 'Span the band',
    says: 'Held magnets must reach the full width of their band to count for it.',
    note: 'Invented, never confirmed. As a gate this alone hid the duck and the butterfly.',
  },
  {
    id: 'corridor',
    label: 'Direct corridor',
    says: 'Adjacent magnets must be joined by a straight fabric strip of this width.',
    note: 'Wrong as a rule — a crescent joins its horns along the arc. Kept as evidence.',
    value: { label: 'mm wide', options: [12, 24] },
  },
  {
    id: 'sparseEngagement',
    label: '96mm engagement',
    says: 'From this band up, at least two held magnets must land on one 96mm thinning phase.',
    note: 'An attribute, not a gate: gating on it silently deleted 64 lawful layouts.',
    value: { label: 'from band', options: [2, 3, 4] },
  },
  {
    id: 'flapLimit',
    label: 'Flap limit',
    says: 'Overhang beyond the padded magnet box must stay WITHIN the limit on every side.',
    note: "Dan's ruling, 11 Aug — within passes. Parked while the engine runs bare.",
    value: { label: 'mm', options: [12, 24] },
  },
]

export interface PolicyState {
  readonly enabled: boolean
  readonly value?: number
}

export type PolicySettings = Readonly<Record<PolicyId, PolicyState>>

/** Every policy off — the state in which this layer is transparent. */
export const ALL_OFF: PolicySettings = Object.freeze({
  minimumMagnets: { enabled: false, value: 1 },
  bandSpan: { enabled: false },
  corridor: { enabled: false, value: 24 },
  sparseEngagement: { enabled: false, value: 3 },
  flapLimit: { enabled: false, value: 12 },
})

/** One variant, with whatever the enabled policies had to say about it. */
export interface AnnotatedVariant {
  readonly variant: MeasuredVariant
  /** Empty when nothing objected. Each entry names the policy that WOULD have excluded this
      variant and why — the variant itself is never dropped. */
  readonly excludedBy: readonly { readonly id: PolicyId; readonly because: string }[]
}

/**
 * Apply the enabled policies as annotations. The returned array always has exactly the same
 * length and order as the input — a policy may mark a variant, never remove one. `pitchMm`
 * arrives from the guarded spec: this layer holds no law values of its own.
 */
export function annotate(
  variants: readonly MeasuredVariant[],
  settings: PolicySettings,
  pitchMm: number,
): AnnotatedVariant[] {
  const halfPitch = pitchMm / 2
  return variants.map((variant) => {
    const excludedBy: { id: PolicyId; because: string }[] = []
    const held = variant.nodes.filter((node) => node.held)

    const minimum = settings.minimumMagnets
    if (minimum.enabled && held.length < (minimum.value ?? 1)) {
      excludedBy.push({
        id: 'minimumMagnets',
        because: `${held.length} held, ${minimum.value ?? 1} required`,
      })
    }

    if (settings.bandSpan.enabled && held.length > 0) {
      const xs = held.map((node) => node.xMm)
      const ys = held.map((node) => node.yMm)
      const reach = Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      )
      const required = (variant.band - 1) * pitchMm
      if (reach !== required) {
        excludedBy.push({
          id: 'bandSpan',
          because: `held set reaches ${reach}mm, band ${variant.band} spans ${required}mm`,
        })
      }
    }

    if (settings.corridor.enabled) {
      const broken = variant.links.filter((link) => !link.direct)
      if (broken.length > 0) {
        excludedBy.push({
          id: 'corridor',
          because: `${broken.length} of ${variant.links.length} adjacent pairs have no straight strip`,
        })
      }
    }

    const sparse = settings.sparseEngagement
    if (sparse.enabled && variant.band >= (sparse.value ?? 3) && held.length > 0) {
      // A 96mm garment keeps one residue class per axis: in half-pitch units, the retained
      // points share one (x mod 4, y mod 4) pair. Count the best of all sixteen phases over
      // the held set — residue arithmetic on supplied coordinates, no geometry.
      const residue = (mm: number) => ((mm / halfPitch) % 4 + 4) % 4
      let best = 0
      for (let rx = 0; rx < 4; rx++) {
        for (let ry = 0; ry < 4; ry++) {
          const active = held.filter(
            (node) => residue(node.xMm) === rx && residue(node.yMm) === ry,
          ).length
          if (active > best) best = active
        }
      }
      if (best < 2) {
        excludedBy.push({ id: 'sparseEngagement', because: `${best} magnet engages on 96mm` })
      }
    }

    const flap = settings.flapLimit
    if (flap.enabled && variant.overhangMm) {
      const limit = flap.value ?? 12
      const over = (['left', 'right', 'bottom', 'top'] as const).filter(
        (side) => variant.overhangMm![side] > limit,
      )
      if (over.length > 0) {
        excludedBy.push({
          id: 'flapLimit',
          because: `${over.join(', ')} beyond ${limit}mm`,
        })
      }
    }

    return { variant, excludedBy }
  })
}
