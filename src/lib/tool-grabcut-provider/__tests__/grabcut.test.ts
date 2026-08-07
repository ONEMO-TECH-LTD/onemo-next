import { describe, it, expect } from 'vitest'
import { MaxFlow } from '../maxflow'
import { grabCutRun, slimCv, GC_BGD, GC_FGD, GC_PR_BGD, GC_PR_FGD } from '../index'

describe('MaxFlow (Dinic)', () => {
  it('solves the textbook two-path graph', () => {
    const mf = new MaxFlow(3, 8)
    mf.addTerminal(0, 3, 0); mf.addTerminal(1, 2, 0); mf.addTerminal(2, 0, 4)
    mf.addEdge(0, 2, 2, 0); mf.addEdge(1, 2, 3, 0)
    expect(mf.compute()).toBe(4)
  })
  it('cuts the cheapest edge of a bottleneck chain and reports the sides', () => {
    const mf = new MaxFlow(2, 4)
    mf.addTerminal(0, 10, 0); mf.addTerminal(1, 0, 10); mf.addEdge(0, 1, 1, 1)
    expect(mf.compute()).toBe(1)
    expect(mf.inSource(0)).toBe(true)
    expect(mf.inSource(1)).toBe(false)
  })
  it('keeps hard-constrained nodes on their own side', () => {
    const mf = new MaxFlow(2, 4)
    mf.addTerminal(0, 1e9, 0); mf.addTerminal(1, 0, 1e9); mf.addEdge(0, 1, 5, 5)
    mf.compute()
    expect(mf.inSource(0)).toBe(true)
    expect(mf.inSource(1)).toBe(false)
  })
  it('handles a disconnected sink (zero flow)', () => {
    const mf = new MaxFlow(2, 2)
    mf.addTerminal(0, 5, 0); mf.addTerminal(1, 0, 5)
    expect(mf.compute()).toBe(0)
    expect(mf.inSource(0)).toBe(true)
    expect(mf.inSource(1)).toBe(false)
  })
})

describe('slimCv provider (OpenCV contract)', () => {
  it('allocates a single-channel plane for new Mat(rows, cols, CV_8UC1)', () => {
    // regression: the 3rd arg is a TYPE CODE (CV_8UC1 === 0), never a channel count — reading it as
    // channels allocated a ZERO-length buffer and every seed stamp silently wrote nowhere.
    const m = new slimCv.Mat(8, 5, slimCv.CV_8UC1) as unknown as { data: Uint8Array }
    expect(m.data.length).toBe(40)
  })
  it('cvtColor RGBA→RGB drops alpha and keeps channel order', () => {
    const d = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]) } as ImageData
    const src = slimCv.matFromImageData(d)
    const dst = new slimCv.Mat()
    slimCv.cvtColor(src, dst, slimCv.COLOR_RGBA2RGB)
    expect(Array.from((dst as unknown as { data: Uint8Array }).data)).toEqual([1, 2, 3, 4, 5, 6])
  })
})

/** Photo-like noise is a DIFFERENT DATA CLASS from clean fixtures — it is what hung the previous
 *  solver while every two-tone test passed (ERRORS.md 2026-08-07). Every case asserts wall clock. */
function noisyPhoto(S: number, seed = 1): Uint8Array {
  const rgb = new Uint8Array(S * S * 3)
  let x = seed
  const rnd = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return (x >>> 8) / 8388608 }
  for (let y = 0; y < S; y++) for (let px = 0; px < S; px++) {
    const i = (y * S + px) * 3
    const inObj = Math.hypot(px - S / 2, y - S / 2) < S * 0.28
    const base = inObj ? [110, 150, 110] : [55, 58, 70]
    for (let c = 0; c < 3; c++) rgb[i + c] = Math.max(0, Math.min(255, base[c] + (rnd() - 0.5) * 90))
  }
  return rgb
}

describe('grabCutRun', () => {
  it('separates two colour regions from seed strokes', () => {
    const w = 24, h = 24
    const rgb = new Uint8Array(w * h * 3)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3
      if (x < w / 2) { rgb[i] = 200; rgb[i + 1] = 30; rgb[i + 2] = 30 }
      else { rgb[i] = 30; rgb[i + 1] = 30; rgb[i + 2] = 200 }
    }
    const mask = new Uint8Array(w * h).fill(GC_PR_BGD)
    for (let y = 10; y < 14; y++) for (let x = 3; x < 7; x++) mask[y * w + x] = GC_FGD
    for (let y = 10; y < 14; y++) for (let x = 17; x < 21; x++) mask[y * w + x] = GC_BGD
    grabCutRun(rgb, mask, w, h, 2)
    const fg = (x: number, y: number) => { const m = mask[y * w + x]; return m === GC_FGD || m === GC_PR_FGD }
    let redFg = 0, blueFg = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (x < w / 2) { if (fg(x, y)) redFg++ } else if (fg(x, y)) blueFg++
    }
    expect(redFg).toBeGreaterThan(w * h * 0.3)
    expect(blueFg).toBeLessThan(w * h * 0.08)
  })

  it('never relabels user-marked pixels', () => {
    const S = 32
    const rgb = noisyPhoto(S)
    const mask = new Uint8Array(S * S).fill(GC_PR_BGD)
    mask[16 * S + 4] = GC_FGD
    mask[16 * S + 27] = GC_BGD
    grabCutRun(rgb, mask, S, S, 1)
    expect(mask[16 * S + 4]).toBe(GC_FGD)
    expect(mask[16 * S + 27]).toBe(GC_BGD)
  })

  it('is a no-op when one side has no samples', () => {
    const S = 16
    const rgb = noisyPhoto(S)
    const mask = new Uint8Array(S * S).fill(GC_PR_BGD)
    const before = Array.from(mask)
    grabCutRun(rgb, mask, S, S, 1)
    expect(Array.from(mask)).toEqual(before)
  })

  it('is deterministic — same input, same cut', () => {
    const S = 48
    const rgb = noisyPhoto(S, 5)
    const run = () => {
      const m = new Uint8Array(S * S).fill(GC_PR_BGD)
      for (let y = 22; y < 26; y++) for (let x = 20; x < 28; x++) m[y * S + x] = GC_FGD
      for (let y = 1; y < 4; y++) for (let x = 1; x < 8; x++) m[y * S + x] = GC_BGD
      grabCutRun(rgb, m, S, S, 2)
      return Array.from(m)
    }
    expect(run()).toEqual(run())
  })

  it.each([64, 128, 256, 512])('TERMINATES on noisy photo data at %ix%i', (S) => {
    const rgb = noisyPhoto(S)
    const mask = new Uint8Array(S * S).fill(GC_PR_BGD)
    for (let y = S / 2 - 3; y < S / 2 + 3; y++) for (let px = S / 2 - 12; px < S / 2 + 12; px++) mask[y * S + px] = GC_FGD
    for (let y = 1; y < 5; y++) for (let px = 1; px < 12; px++) mask[y * S + px] = GC_BGD
    const t = Date.now()
    grabCutRun(rgb, mask, S, S, 3)
    const ms = Date.now() - t
    expect(ms).toBeLessThan(15000)
    const c = (S / 2) * S + S / 2
    expect(mask[c] === GC_FGD || mask[c] === GC_PR_FGD).toBe(true) // the seeded object holds
    expect(mask[2 * S + 2]).toBe(GC_BGD)                            // the seeded corner holds
  }, 30000)

  it('TERMINATES on the refine shape (nearly all probable-foreground + an erase stroke)', () => {
    const S = 128
    const rgb = noisyPhoto(S, 3)
    const mask = new Uint8Array(S * S).fill(GC_PR_FGD)
    for (let y = 60; y < 66; y++) for (let x = 40; x < 80; x++) mask[y * S + x] = GC_BGD
    const t = Date.now()
    grabCutRun(rgb, mask, S, S, 3)
    expect(Date.now() - t).toBeLessThan(15000)
    expect(mask[62 * S + 60]).toBe(GC_BGD)
  }, 30000)
})
