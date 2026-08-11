// THE ENGINE CLIENT — the ui/ adapter the shell calls to run one solve off-thread (EC-12) and to
// place a family's answer in the canvas frame. ui/ may reach outward (README); the shell itself
// still computes nothing — every number here is the engine's own, re-framed for drawing.

import type { PointMM, SolveOutcome, SolveRequest } from '../solver/contract'

// Re-exported so the shell's imports stay inside ui/ — the page never names a solver path.
export type EnginePoint = PointMM
export type EngineSolved = Extract<SolveOutcome, { status: 'solved' }>

/** One solve, off the interaction thread. A fresh worker per call — no queue, no shared state. */
export function solveOffThread(request: SolveRequest): Promise<SolveOutcome> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./solve.worker.ts', import.meta.url))
    worker.onmessage = (event: MessageEvent<{ ok: boolean; outcome?: SolveOutcome; error?: string }>) => {
      worker.terminate()
      if (event.data.ok && event.data.outcome) resolve(event.data.outcome)
      else reject(new Error(event.data.error ?? 'solve failed'))
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message))
    }
    worker.postMessage(request)
  })
}

/**
 * §5.2 inverted for the static-shape canvas. The engine places the shape so its centre Cκ lands on
 * the parity target a: T(p) = a + σ·(p − Cκ), and reports magnets in the SHAPE frame (q − a). The
 * canvas draws the shape bbox-centred at its own origin, so a family's evidence is drawn at
 *
 *     canvasPoint = shapeFramePoint + σ·(Cκ − Cbbox)
 *
 * — one translation, no other geometry. σ is the family's own scale.
 */
export function familyFrameOffset(
  centreMM: PointMM,
  bboxCentreMM: PointMM,
  sigma: number,
): PointMM {
  return [sigma * (centreMM[0] - bboxCentreMM[0]), sigma * (centreMM[1] - bboxCentreMM[1])]
}
