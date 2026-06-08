// outline-core/livewire.ts — magnetic-lasso pathfinder (A3b/c · AMEND-C7).
//
// The Photoshop "magnetic lasso" / intelligent-scissors model: between two user anchors, snap a path
// to the strongest nearby image edges. Implemented as Dijkstra shortest-path over a per-pixel COST
// grid (low cost = strong edge), inside a bounded ROI. v1 = first-order Dijkstra on an edge-cost
// grid (no curvature term — invalid in pixel-node Dijkstra, AMEND-C7); the BEN2-boundary prior is
// folded into the cost grid by the caller when available (hybrid, A3c), optional for Manual (A3b).
//
// This module is PURE: it takes a numeric cost grid + endpoints and returns a path. No DOM, no image
// decoding (the caller builds the cost grid from the canvas). Golden-testable.

export interface CostGrid {
  cost: Float32Array // per-cell traversal cost (> 0); low = edge
  width: number
  height: number
}

/** Clamp a point to grid bounds. */
function clampCell(x: number, y: number, w: number, h: number): [number, number] {
  return [Math.max(0, Math.min(w - 1, Math.round(x))), Math.max(0, Math.min(h - 1, Math.round(y)))]
}

/**
 * Dijkstra shortest path from `from` to `to` over the cost grid (8-connected), restricted to a
 * rectangular ROI inflated around the endpoints. Returns the path in grid-cell coordinates
 * (inclusive of both endpoints), or a straight 2-point fallback if no path is found.
 */
export function livewirePath(
  grid: CostGrid,
  from: [number, number],
  to: [number, number],
  roiMarginCells = 48,
): Array<[number, number]> {
  const { cost, width: W, height: H } = grid
  const [fx, fy] = clampCell(from[0], from[1], W, H)
  const [tx, ty] = clampCell(to[0], to[1], W, H)

  // Bounded ROI around the two endpoints (keeps Dijkstra cheap on cursor-follow).
  const x0 = Math.max(0, Math.min(fx, tx) - roiMarginCells)
  const y0 = Math.max(0, Math.min(fy, ty) - roiMarginCells)
  const x1 = Math.min(W - 1, Math.max(fx, tx) + roiMarginCells)
  const y1 = Math.min(H - 1, Math.max(fy, ty) + roiMarginCells)
  const rw = x1 - x0 + 1
  const rh = y1 - y0 + 1
  const n = rw * rh

  const ri = (x: number, y: number) => (y - y0) * rw + (x - x0)
  const dist = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const done = new Uint8Array(n)
  const start = ri(fx, fy)
  const goal = ri(tx, ty)
  dist[start] = 0

  // Binary-heap priority queue (index, key) — avoids O(n^2) scan on larger ROIs.
  const heapIdx: number[] = []
  const heapKey: number[] = []
  const push = (idx: number, key: number) => {
    heapIdx.push(idx); heapKey.push(key)
    let c = heapIdx.length - 1
    while (c > 0) { const p = (c - 1) >> 1; if (heapKey[p] <= heapKey[c]) break; ;[heapKey[p], heapKey[c]] = [heapKey[c], heapKey[p]]; [heapIdx[p], heapIdx[c]] = [heapIdx[c], heapIdx[p]]; c = p }
  }
  const pop = (): number => {
    const top = heapIdx[0]
    const li = heapIdx.length - 1
    heapIdx[0] = heapIdx[li]; heapKey[0] = heapKey[li]; heapIdx.pop(); heapKey.pop()
    let c = 0; const len = heapIdx.length
    while (true) { const l = 2 * c + 1, r = l + 1; let s = c; if (l < len && heapKey[l] < heapKey[s]) s = l; if (r < len && heapKey[r] < heapKey[s]) s = r; if (s === c) break; [heapKey[s], heapKey[c]] = [heapKey[c], heapKey[s]]; [heapIdx[s], heapIdx[c]] = [heapIdx[c], heapIdx[s]]; c = s }
    return top
  }
  push(start, 0)

  const SQRT2 = Math.SQRT2
  while (heapIdx.length) {
    const cur = pop()
    if (done[cur]) continue
    done[cur] = 1
    if (cur === goal) break
    const cy = Math.floor(cur / rw) + y0
    const cx = (cur % rw) + x0
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue
        const nx = cx + dx, ny = cy + dy
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue
        const ni = ri(nx, ny)
        if (done[ni]) continue
        const step = (dx !== 0 && dy !== 0 ? SQRT2 : 1) * cost[ny * W + nx]
        const nd = dist[cur] + step
        if (nd < dist[ni]) { dist[ni] = nd; prev[ni] = cur; push(ni, nd) }
      }
    }
  }

  if (prev[goal] === -1 && goal !== start) return [[fx, fy], [tx, ty]] // no path → straight fallback
  const path: Array<[number, number]> = []
  let i = goal
  let guard = 0
  while (i !== -1 && guard++ < n + 1) {
    const y = Math.floor(i / rw) + y0
    const x = (i % rw) + x0
    path.push([x, y])
    if (i === start) break
    i = prev[i]
  }
  path.reverse()
  return path
}
