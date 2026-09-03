// perf-log.ts — the bench's performance log, as a plain object the page owns.
//
// A row must describe the solve that was ASKED FOR, not whatever is selected when the answer comes
// back: a solve still running when the shape changes was being recorded under the new shape (Dan's
// screenshots, 2026-09-03). The identity therefore travels with the request id, and a superseded
// answer releases its record on arrival so nothing accumulates (QA F1).
//
// Display only: it holds no engine import and measures nothing — the page hands it the elapsed time
// and the delivered result.

export interface PerfRow {
  key: string
  shape: string
  band: number
  ms: number
  sizeMM?: number
  count?: number
  /** first solve of this shape and band on this screen */
  cold: boolean
}

export interface SolveResult {
  effSize?: number
  grid?: { anchors?: unknown[] }
}

export interface PerfLog {
  /** Record what a request was for, at the moment it is sent. */
  asked(id: number, shape: string, band: number): void
  /** Release the request's record and, when it delivered a model, return its row. */
  arrived(id: number, model: SolveResult | null | undefined, ms: number): PerfRow | null
  /** Requests still in flight — a leak shows up here. */
  readonly pending: number
}

export function createPerfLog(): PerfLog {
  const asked = new Map<number, { shape: string; band: number }>()
  const seen = new Set<string>()
  return {
    asked(id, shape, band) { asked.set(id, { shape, band }) },
    arrived(id, model, ms) {
      const request = asked.get(id)
      asked.delete(id)
      if (!request || !model) return null
      const key = request.shape + '·B' + request.band
      const cold = !seen.has(key)
      seen.add(key)
      return { key, shape: request.shape, band: request.band, ms,
        sizeMM: model.effSize, count: model.grid?.anchors?.length, cold }
    },
    get pending() { return asked.size },
  }
}
