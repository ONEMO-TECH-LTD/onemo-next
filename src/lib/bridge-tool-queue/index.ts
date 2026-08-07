// bridge-tool-queue — v1's TOOL QUEUE + TIMEOUT laws cloned clean (Dan device r5: tools were
// silently DEAD while busy — taps swallowed with zero feedback). The laws:
//   • EVERY tool op runs through ONE serialized latest-wins queue: an op landing mid-processing
//     queues (visible), runs right after, and NOTHING is ever dropped. No tool is gated on busy.
//   • EVERY await in a tool path carries a timeout → a hang becomes a visible fault with busy
//     released — a stuck-busy lockout is impossible by construction.
// Framework-free; the adopting driver injects the status surface.

export const T_COMPUTE_MS = 30_000   // compute ceiling
export const T_DOWNLOAD_MS = 180_000 // weights on slow links

export class ToolTimeout extends Error {
  constructor(what: string, ms: number) { super(`${what} timed out after ${Math.round(ms / 1000)}s`) }
}

export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new ToolTimeout(what, ms)), ms)
    p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
  })
}

/** Serialized latest-wins tool queue (verbatim v1 semantics): at most one op runs; a second op
 *  arriving replaces any earlier queued op (latest wins) and runs right after; errors surface
 *  through onError and NEVER wedge the queue. */
export class ToolQueue {
  private busy = false
  private pending: (() => Promise<void>) | null = null
  constructor(
    private onQueued?: () => void,            // visible "your tap is queued" feedback
    private onError?: (e: unknown) => void,   // loud fault surface
  ) {}
  get isBusy(): boolean { return this.busy }
  run(op: () => Promise<void>): void {
    if (this.busy) { this.pending = op; this.onQueued?.(); return }
    this.busy = true
    void (async () => {
      try { await op() } catch (e) { this.onError?.(e) }
      this.busy = false
      const q = this.pending
      if (q) { this.pending = null; this.run(q) }
    })()
  }
}
