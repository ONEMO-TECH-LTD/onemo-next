// ENGINE LOADER — carries an outline to GPT Pro's exact core and carries the numbers back.
//
// It computes NOTHING. No geometry, no default, no threshold, no interpretation lives here; if
// arithmetic on millimetres ever appears in this file it is in the wrong place. Every value below
// was decided by `measure_all()` in vendor/magfit, which enters no policy path: no selection, no
// corridor, no band-span rule, no sparse gate, no flap threshold.
//
// The door is `/api/grid-engine/measure`. In phase A it runs the native binary (dev only); in
// phase B the same door serves the WebAssembly build. The loader cannot tell the difference —
// that is the point of the door.

/** A lattice position measured against the shape at one size. */
export interface MeasuredNode {
  readonly xMm: number
  readonly yMm: number
  /** The complete 24mm disc is on fabric. Exact touching counts as held. */
  readonly held: boolean
  /** Distance to the nearest outline edge; negative when the centre is outside the shape. */
  readonly clearanceMm: number
}

/** One orthogonal 48mm pair of held magnets, with the engine's straight-strip fact. */
export interface MeasuredLink {
  readonly axMm: number
  readonly ayMm: number
  readonly bxMm: number
  readonly byMm: number
  /** A straight full-width fabric strip joins the two centres. A fact, never a gate —
      a crescent joins its horns along the arc and reads false here. */
  readonly direct: boolean
}

/** Raw shape overhang beyond the padded box of the held magnets. Numbers, no thresholds. */
export interface MeasuredOverhang {
  readonly left: number
  readonly right: number
  readonly bottom: number
  readonly top: number
}

/** One manufactured size, every lattice position reported — held or not. */
export interface MeasuredSize {
  readonly band: number
  readonly sizeMm: number
  readonly widthMm: number
  readonly heightMm: number
  readonly heldCount: number
  readonly nodes: readonly MeasuredNode[]
  readonly links: readonly MeasuredLink[]
  readonly overhangMm?: MeasuredOverhang
}

export interface Measurement {
  readonly ok: boolean
  readonly vertexCount?: number
  readonly sizes: readonly MeasuredSize[]
  readonly error?: string
}

/** An outline as coordinate pairs in any consistent units — the tracer's own fractions work. */
export type OutlinePoints = ReadonlyArray<readonly [number, number]>

/**
 * Measure one outline across the requested bands. `scale` is the whole-number trace resolution
 * the core canonicalises against — a transport detail, never a product size.
 */
export async function measureOutline(
  outline: OutlinePoints,
  bands: readonly number[],
  scale = 20000,
): Promise<Measurement> {
  const response = await fetch('/api/grid-engine/measure', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ vertices: outline, bands, scale }),
  })
  const parsed = (await response.json()) as Measurement
  if (!parsed.ok && parsed.error === undefined) {
    return { ok: false, sizes: [], error: `engine returned ${response.status}` }
  }
  return parsed
}

/** The seven saved cut-out traces, so the surface can be driven without an upload. */
export async function loadCorpus(): Promise<Record<string, OutlinePoints>> {
  const response = await fetch('/api/grid-engine/corpus')
  if (!response.ok) return {}
  return (await response.json()) as Record<string, OutlinePoints>
}
