// ENGINE LOADER — carries a fully-built request to GPT Pro's exact kernel and the numbers back.
//
// It computes NOTHING and decides NOTHING. The kernel generates nothing either: lattice positions,
// registration and law values are all supplied by the bridge from the spec/engine unit — the one
// lattice authority. The kernel answers only: held / clearance / link facts / overhang.
//
// The door is `/api/grid-engine/measure`: the wasm build when compiled, the native binary in dev.
// Proven byte-identical on the whole corpus.

/** A lattice position measured against the shape at one size. */
export interface MeasuredNode {
  readonly xMm: number
  readonly yMm: number
  /** The complete disc is on fabric. Exact touching counts as held. */
  readonly held: boolean
  /** Distance to the nearest outline edge; negative when the centre is outside the shape. */
  readonly clearanceMm: number
}

/** One orthogonal pitch-spaced pair of held positions, with the engine's straight-strip fact. */
export interface MeasuredLink {
  readonly axMm: number
  readonly ayMm: number
  readonly bxMm: number
  readonly byMm: number
  /** A straight full-width fabric strip joins the two centres — a fact, never a gate. */
  readonly direct: boolean
}

/** Raw shape overhang beyond the padded box of the held positions. Numbers, no thresholds. */
export interface MeasuredOverhang {
  readonly left: number
  readonly right: number
  readonly bottom: number
  readonly top: number
}

/** One measured variant: one size, one template's supplied positions, everything reported. */
export interface MeasuredVariant {
  readonly band: number
  readonly sizeMm: number
  readonly runsX: number
  readonly runsY: number
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
  readonly sizes: readonly MeasuredVariant[]
  readonly error?: string
}

/** An outline as coordinate pairs in any consistent units — the tracer's own fractions work. */
export type OutlinePoints = ReadonlyArray<readonly [number, number]>

/** One job the bridge built: one size, one template's positions, in millimetres. */
export interface MeasureJob {
  readonly band: number
  readonly sizeMm: number
  readonly runsX: number
  readonly runsY: number
  readonly positions: ReadonlyArray<readonly [number, number]>
}

export interface MeasureRequest {
  readonly vertices: OutlinePoints
  readonly scale: number
  readonly pitchMm: number
  readonly radiusMm: number
  /** Corridor strip radius for link facts; the kernel uses the disc radius when absent. */
  readonly linkRadiusMm?: number
  readonly jobs: readonly MeasureJob[]
}

/** Transport only. The request arrives complete; the response returns verbatim. */
export async function measureRequest(request: MeasureRequest): Promise<Measurement> {
  const response = await fetch('/api/grid-engine/measure', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
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
