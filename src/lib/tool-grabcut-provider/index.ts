// tool-grabcut-provider — the SLIM GrabCut provider: satisfies tool-grabcut's CvProvider interface
// with a self-contained implementation, so the brush needs NO 13MB OpenCV build (Dan 2026-08-07:
// "grab cut goes in only if we strip it to grab cut only… no 13mb").
//
// This is GrabCut itself (Rother/Kolmogorov/Blake 2004): per-side colour models + a graph cut over
// the pixel grid, iterated. Three honest, documented engineering choices vs OpenCV's build:
//   • colour model = k-means-initialised GMM with DIAGONAL covariance (OpenCV uses full covariance).
//     Same model family, cheaper and numerically simpler.
//   • the cut is solved by our own Dinic max-flow (./maxflow) — chosen over Boykov–Kolmogorov
//     because it terminates BY CONSTRUCTION (see that file's header + ERRORS.md 2026-08-07).
//   • the solve runs on a bounded grid (SOLVE_MAX) and the labels are upsampled back, so cost stays
//     predictable on a phone regardless of the caller's working resolution.
// Everything else — mask semantics, iteration, and the constants tool-grabcut reads — matches
// OpenCV's contract exactly, so tool-grabcut stays VERBATIM v1 and this provider is replaceable
// (drop in a real slim OpenCV build later and delete nothing else).

import { MaxFlow } from './maxflow'
import type { CvProvider } from '@/lib/tool-grabcut'

// OpenCV's own mask values — tool-grabcut reads these off the provider, so they must match.
export const GC_BGD = 0
export const GC_FGD = 1
export const GC_PR_BGD = 2
export const GC_PR_FGD = 3
export const GC_INIT_WITH_MASK = 1
export const CV_8UC1 = 0
export const COLOR_RGBA2RGB = 1

const K = 5              // GMM components (OpenCV's count)
const KMEANS_ITERS = 6
const GAMMA = 50         // smoothness weight (Rother et al.)
const MIN_VAR = 4        // variance floor — no singular component on flat colour
const HARD = 1e9         // "infinite" terminal capacity for user-marked pixels
export const SOLVE_MAX = 256 // graph side cap: ≤65k nodes keeps a phone honest

/** Minimal Mat. The 3-arg form is OpenCV's `new Mat(rows, cols, TYPE)` — the third argument is a
 *  TYPE CODE, never a channel count (tool-grabcut passes CV_8UC1 for the label plane), so it
 *  allocates single-channel. Multi-channel mats come from matFromImageData / cvtColor. */
class LabMat {
  data: Uint8Array
  rows: number
  cols: number
  channels: number
  constructor(rows = 0, cols = 0, _type = CV_8UC1) {
    this.rows = rows; this.cols = cols; this.channels = 1
    this.data = new Uint8Array(Math.max(0, rows * cols))
  }
  delete(): void { this.data = new Uint8Array(0) }
}

interface Gmm { mean: Float64Array; varr: Float64Array; weight: Float64Array; k: number }

/** k-means over RGB → per-component mean + diagonal variance + weight (deterministic seeding). */
function fitGmm(px: Uint8Array, idx: Int32Array, count: number): Gmm | null {
  if (count === 0) return null
  const k = Math.min(K, count)
  const mean = new Float64Array(k * 3)
  const varr = new Float64Array(k * 3).fill(255 * 255)
  const weight = new Float64Array(k)
  for (let c = 0; c < k; c++) {
    const s = idx[Math.floor((c + 0.5) * count / k)] * 3
    mean[c * 3] = px[s]; mean[c * 3 + 1] = px[s + 1]; mean[c * 3 + 2] = px[s + 2]
  }
  const assign = new Int32Array(count)
  for (let it = 0; it < KMEANS_ITERS; it++) {
    for (let i = 0; i < count; i++) {
      const s = idx[i] * 3
      let best = 0, bd = Infinity
      for (let c = 0; c < k; c++) {
        const dr = px[s] - mean[c * 3], dg = px[s + 1] - mean[c * 3 + 1], db = px[s + 2] - mean[c * 3 + 2]
        const d = dr * dr + dg * dg + db * db
        if (d < bd) { bd = d; best = c }
      }
      assign[i] = best
    }
    const sum = new Float64Array(k * 3), sq = new Float64Array(k * 3), cnt = new Float64Array(k)
    for (let i = 0; i < count; i++) {
      const s = idx[i] * 3, c = assign[i]
      cnt[c]++
      for (let ch = 0; ch < 3; ch++) { const v = px[s + ch]; sum[c * 3 + ch] += v; sq[c * 3 + ch] += v * v }
    }
    for (let c = 0; c < k; c++) {
      if (cnt[c] === 0) { weight[c] = 0; continue }
      weight[c] = cnt[c] / count
      for (let ch = 0; ch < 3; ch++) {
        const m = sum[c * 3 + ch] / cnt[c]
        mean[c * 3 + ch] = m
        varr[c * 3 + ch] = Math.max(MIN_VAR, sq[c * 3 + ch] / cnt[c] - m * m)
      }
    }
  }
  return { mean, varr, weight, k }
}

/** −log p(colour | model) — the data term; large when the pixel does not belong to this side. */
function negLogProb(g: Gmm | null, r: number, gg: number, b: number): number {
  if (!g) return 0
  let best = Infinity
  for (let c = 0; c < g.k; c++) {
    if (g.weight[c] <= 0) continue
    const vr = g.varr[c * 3], vg = g.varr[c * 3 + 1], vb = g.varr[c * 3 + 2]
    const dr = r - g.mean[c * 3], dg = gg - g.mean[c * 3 + 1], db = b - g.mean[c * 3 + 2]
    const e = 0.5 * ((dr * dr) / vr + (dg * dg) / vg + (db * db) / vb)
      + 0.5 * Math.log(vr * vg * vb) - Math.log(g.weight[c])
    if (e < best) best = e
  }
  return best === Infinity ? 0 : best
}

/** One GrabCut pass on an already-bounded grid. Mutates `mask` (OpenCV label semantics). */
function solveGrid(rgb: Uint8Array, mask: Uint8Array, w: number, h: number, iters: number): void {
  const n = w * h
  const diff2 = (i: number, j: number) => {
    const a = i * 3, b = j * 3
    const dr = rgb[a] - rgb[b], dg = rgb[a + 1] - rgb[b + 1], db = rgb[a + 2] - rgb[b + 2]
    return dr * dr + dg * dg + db * db
  }
  let acc = 0, pairs = 0
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (x + 1 < w) { acc += diff2(i, i + 1); pairs++ }
    if (y + 1 < h) { acc += diff2(i, i + w); pairs++ }
  }
  const beta = pairs > 0 && acc > 0 ? 1 / (2 * (acc / pairs)) : 0

  const fgIdx = new Int32Array(n), bgIdx = new Int32Array(n)
  for (let it = 0; it < Math.max(1, iters); it++) {
    let nf = 0, nb = 0
    for (let i = 0; i < n; i++) {
      const m = mask[i]
      if (m === GC_FGD || m === GC_PR_FGD) fgIdx[nf++] = i
      else bgIdx[nb++] = i
    }
    if (nf === 0 || nb === 0) return // nothing to separate — leave the caller's labels alone
    const fg = fitGmm(rgb, fgIdx, nf)
    const bg = fitGmm(rgb, bgIdx, nb)

    const flow = new MaxFlow(n, n * 2 + 8)
    for (let i = 0; i < n; i++) {
      const m = mask[i]
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2]
      if (m === GC_FGD) flow.addTerminal(i, HARD, 0)
      else if (m === GC_BGD) flow.addTerminal(i, 0, HARD)
      else flow.addTerminal(i, negLogProb(bg, r, g, b), negLogProb(fg, r, g, b))
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (x + 1 < w) { const c = GAMMA * Math.exp(-beta * diff2(i, i + 1)); flow.addEdge(i, i + 1, c, c) }
      if (y + 1 < h) { const c = GAMMA * Math.exp(-beta * diff2(i, i + w)); flow.addEdge(i, i + w, c, c) }
    }
    flow.compute()
    for (let i = 0; i < n; i++) {
      const m = mask[i]
      if (m === GC_FGD || m === GC_BGD) continue // user-marked pixels are never relabelled
      mask[i] = flow.inSource(i) ? GC_PR_FGD : GC_PR_BGD
    }
  }
}

/** GrabCut at the caller's resolution — solved on a ≤SOLVE_MAX grid, labels upsampled back. */
export function grabCutRun(rgb: Uint8Array, mask: Uint8Array, w: number, h: number, iters: number): void {
  const side = Math.max(w, h)
  if (side <= SOLVE_MAX) { solveGrid(rgb, mask, w, h, iters); return }
  const s = SOLVE_MAX / side
  const sw = Math.max(1, Math.round(w * s)), sh = Math.max(1, Math.round(h * s))
  const srgb = new Uint8Array(sw * sh * 3)
  const smask = new Uint8Array(sw * sh)
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const ox = Math.min(w - 1, Math.round(x / s)), oy = Math.min(h - 1, Math.round(y / s))
    const si = (y * sw + x) * 3, oi = (oy * w + ox) * 3
    srgb[si] = rgb[oi]; srgb[si + 1] = rgb[oi + 1]; srgb[si + 2] = rgb[oi + 2]
    smask[y * sw + x] = mask[oy * w + ox] // nearest label — hard seeds survive downsampling
  }
  solveGrid(srgb, smask, sw, sh, iters)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (mask[i] === GC_FGD || mask[i] === GC_BGD) continue
    const sx = Math.min(sw - 1, Math.round(x * s)), sy = Math.min(sh - 1, Math.round(y * s))
    mask[i] = smask[sy * sw + sx]
  }
}

/** The CvProvider tool-grabcut consumes — a drop-in for the banned OpenCV build. */
export const slimCv: CvProvider = {
  Mat: LabMat as unknown as CvProvider['Mat'],
  matFromImageData(d: ImageData) {
    const m = new LabMat(d.height, d.width)
    m.channels = 4
    m.data = new Uint8Array(d.data.buffer.slice(0))
    return m
  },
  cvtColor(src: unknown, dst: unknown, _code: number) {
    const s = src as LabMat, o = dst as LabMat
    const n = s.rows * s.cols
    o.rows = s.rows; o.cols = s.cols; o.channels = 3
    o.data = new Uint8Array(n * 3)
    for (let i = 0; i < n; i++) { o.data[i * 3] = s.data[i * 4]; o.data[i * 3 + 1] = s.data[i * 4 + 1]; o.data[i * 3 + 2] = s.data[i * 4 + 2] }
  },
  grabCut(img: unknown, mask: unknown, _rect: unknown, _bgd: unknown, _fgd: unknown, iters: number, _mode: number) {
    const im = img as LabMat, mk = mask as LabMat
    grabCutRun(im.data, mk.data, im.cols, im.rows, iters)
  },
  Rect: class { constructor(public x: number, public y: number, public w: number, public h: number) {} } as unknown as CvProvider['Rect'],
  COLOR_RGBA2RGB, CV_8UC1, GC_BGD, GC_FGD, GC_PR_BGD, GC_PR_FGD, GC_INIT_WITH_MASK,
}
