// THE SOLVE WORKER — EC-12: solver work is never coupled to pinch, resize, pan, drag, camera
// movement or variant browsing. A solve runs OFF the interaction thread, once per request; the
// shell then browses the returned families as a pure lookup.

import { solve } from '../solver/solve'
import type { SolveRequest } from '../solver/contract'

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  try {
    const outcome = solve(event.data)
    ;(self as unknown as Worker).postMessage({ ok: true, outcome })
  } catch (error) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: String(error) })
  }
}
