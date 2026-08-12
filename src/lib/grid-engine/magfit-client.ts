// grid-engine/magfit-client.ts — the door to the FIT COMPUTE.
//
// Same station as the bridge: the shell calls this for every computed fit answer and never
// assembles geometry itself. The computation runs in the magfit core (vendor/magfit,
// magfit-core/0.2.0 — the corrected engine per MAGFIT_CONTRACT_ADDENDUM_v1.1) behind
// /api/magfit; this file converts an traced outline into the engine's input, carries the
// policy, and hands back the engine's own numbers untouched. It decides nothing.

export type OutlinePoint = [number, number]

export interface MagnetOut {
  x24: number
  y24: number
  xMm: number
  yMm: number
}

/** Addendum §B3 — limits are maxima; trivialLimb = exceeded but no broad tongue. */
export interface FlapSideOut {
  mm: number
  within12: boolean
  within24: boolean
  broadBeyond12: boolean
  broadBeyond24: boolean
  trivialLimb12: boolean
  trivialLimb24: boolean
}

export interface BandOut {
  band: number
  fit: boolean
  reason: string
  sizeMm?: number
  widthMm?: number
  heightMm?: number
  templateRunsX?: number
  templateRunsY?: number
  magnets?: MagnetOut[]
  links?: Array<{ ax: number; ay: number; bx: number; by: number }>
  binding?: {
    kind: string
    nodeXMm: number
    nodeYMm: number
    edgeIndex: number
    clearanceMm: number
    slackMm: number
  }
  flap?: {
    left: FlapSideOut
    right: FlapSideOut
    bottom: FlapSideOut
    top: FlapSideOut
    horizontalImbalanceMm: number
    verticalImbalanceMm: number
  }
  sparse?: { xResidue: number; yResidue: number; connected: boolean; activeNodes: MagnetOut[] }
}

export interface MagfitResult {
  ok: boolean
  engine?: string
  selection?: string
  vertexCount?: number
  bands?: BandOut[]
  error?: string
}

export type SelectionMode = 'LAYOUT_FIRST' | 'SIZE_FIRST'

/**
 * The engine centres the shape's bbox on the lattice origin and scales its longest side to
 * each candidate size. Handing it the outline normalised the same way (bbox centred, longest
 * side 1) makes the returned millimetre coordinates drop straight onto the canvas.
 */
export function normaliseOutline(outline: OutlinePoint[]): OutlinePoint[] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of outline) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  return outline.map(([x, y]) => [(x - cx) / span, (y - cy) / span])
}

/**
 * Two optional STRICT filters, off by default (§B7/§B8 — neither is Dan's law): the
 * band-span filter (a band-N layout must stretch across the band) and the strict 96
 * gate (bands 3+ must couple to the sparse garment as a connected pair). By default the
 * engine reports 96 engagement as evidence and prefers it in ranking, without gating.
 */
export interface SolveLaws {
  bandSpan: boolean
  sparsePair: boolean
}

/**
 * One solve, all bands. Policy defaults are the addendum's law: layout-first calibration,
 * 96mm engaging from band 3 with a connected pair, band-span required. The selection mode
 * and the two law gates are the ruled ranges kept testable (Dan's method: add all options
 * and test).
 */
export async function solveMagfit(
  outline: OutlinePoint[],
  selection: SelectionMode,
  laws: SolveLaws = { bandSpan: false, sparsePair: false },
): Promise<MagfitResult> {
  try {
    const response = await fetch('/api/magfit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        vertices: normaliseOutline(outline),
        bands: [2, 3, 4],
        scale: 20000,
        selection,
        sparseMode: 'ANY',
        sparseMinBand: 3,
        sparseMinActive: laws.sparsePair ? 2 : 1,
        require96Connected: laws.sparsePair,
        requireLinks: true,
        requireBandSpan: laws.bandSpan,
      }),
    })
    return (await response.json()) as MagfitResult
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
