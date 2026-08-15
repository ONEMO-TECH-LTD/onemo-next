// BEHAVIOURAL LAW FIXTURES — Frankenstein Phase 0, item 2.
//
// Synthetic shapes prove each law generalises beyond the seven canon cutouts (the R3
// counterexample discipline + Grok's behavioural fixture style): a rule that passes canon but
// fails its counterexample is invalid. Every fixture states the law it guards.

import { describe, expect, it } from 'vitest'

import { solveCutout } from '../bridge'
import type { Contour, Pt } from '../compute/types'
import { RELEASED, RELEASED_CALIBRATION } from '../spec'

const PAD = RELEASED.grid.paddingMM

function ring(pts: [number, number][]): Contour {
  return { outer: { pts: pts as Pt[] }, holes: [] }
}

/** Axis-aligned rounded-nothing rectangle. */
function rect(w: number, h: number): Contour {
  return ring([
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ])
}

/** Circle approximation (48 chords). */
function circle(d: number): Contour {
  const r = d / 2
  const pts: [number, number][] = []
  for (let i = 0; i < 48; i++) {
    const a = (2 * Math.PI * i) / 48
    pts.push([r + r * Math.cos(a), r + r * Math.sin(a)])
  }
  return ring(pts)
}

/** Mushroom: a wide top cap on a thin stem — the mass is HIGH. */
function mushroom(): Contour {
  return ring([
    [0, 0],
    [100, 0],
    [100, 55],
    [62, 55],
    [62, 100],
    [38, 100],
    [38, 55],
    [0, 55],
  ])
}

/** Two fat lobes joined by a narrow bar (a horizontal dumbbell). */
function dumbbell(): Contour {
  return ring([
    [0, 0],
    [40, 0],
    [40, 35],
    [60, 35],
    [60, 0],
    [100, 0],
    [100, 100],
    [60, 100],
    [60, 65],
    [40, 65],
    [40, 100],
    [0, 100],
  ])
}

/** A square with a deep thin spike off its top — the tip can never host a disc. */
function spiked(): Contour {
  return ring([
    [0, 30],
    [46, 30],
    [50, 0],
    [54, 30],
    [100, 30],
    [100, 130],
    [0, 130],
  ])
}

/** A square with a notch biting toward the centre — centre-inside alone is not legality. */
function notched(): Contour {
  return ring([
    [0, 0],
    [100, 0],
    [100, 40],
    [55, 40],
    [55, 60],
    [100, 60],
    [100, 100],
    [0, 100],
  ])
}

const solve = (c: Contour) => solveCutout(RELEASED, RELEASED_CALIBRATION, c)!

describe('behavioural laws on synthetic counterexamples', () => {
  it('R3-1 · wide shallow shape: band 2 pairs HORIZONTALLY (orientation follows the shape)', { timeout: 300000 }, () => {
    const judged = solve(rect(160, 70))
    const b2 = judged.bands.find((b) => b.band.band === 2)!.variants[0]
    expect(b2.anchors.length).toBe(2)
    const [a, b] = b2.anchors
    expect(Math.abs(a.p[1] - b.p[1])).toBeLessThan(1) // same row
    expect(Math.abs(a.p[0] - b.p[0])).toBeGreaterThan(24) // spread across
  })

  it('R3-2 · tall narrow shape: band 2 pairs VERTICALLY', { timeout: 300000 }, () => {
    const judged = solve(rect(70, 160))
    const b2 = judged.bands.find((b) => b.band.band === 2)!.variants[0]
    expect(b2.anchors.length).toBe(2)
    const [a, b] = b2.anchors
    expect(Math.abs(a.p[0] - b.p[0])).toBeLessThan(1)
    expect(Math.abs(a.p[1] - b.p[1])).toBeGreaterThan(24)
  })

  it('R3-4 · circle: a square bbox never authorises corner discs — every anchor is exactly proven', { timeout: 300000 }, () => {
    const judged = solve(circle(100))
    for (const band of judged.bands) {
      for (const v of band.variants) {
        // the engine's own clearance is the proof: no anchor within the pad of the arc
        const r = v.sizeMM / 2
        for (const anchor of v.anchors) {
          const d = Math.hypot(anchor.p[0] - r, anchor.p[1] - r)
          expect(r - d).toBeGreaterThanOrEqual(PAD - 1e-6)
        }
      }
    }
  })

  it('R3-5/Grok · spike: the tip never hosts a magnet', { timeout: 300000 }, () => {
    const judged = solve(spiked())
    for (const band of judged.bands) {
      for (const v of band.variants) {
        const scale = v.sizeMM / 130
        for (const anchor of v.anchors) {
          // the spike occupies y < 30·scale — no anchor may sit in it
          expect(anchor.p[1]).toBeGreaterThanOrEqual(30 * scale - 1e-6)
        }
      }
    }
  })

  it('R3-7 · concave notch: centre-inside alone is not legality — anchors clear the notch walls', { timeout: 300000 }, () => {
    const judged = solve(notched())
    for (const band of judged.bands) {
      for (const v of band.variants) {
        const s = v.sizeMM / 100
        for (const anchor of v.anchors) {
          const [x, y] = anchor.p
          // inside the notch band (y in 40s..60s), anchors must keep the pad from the notch mouth
          if (y > 40 * s - PAD && y < 60 * s + PAD) {
            expect(55 * s - x).toBeGreaterThanOrEqual(PAD - 1e-6)
          }
        }
      }
    }
  })

  it('Grok · top-heavy mushroom: the band-1 single sits in the CAP, not the stem', { timeout: 300000 }, () => {
    const judged = solve(mushroom())
    const b1 = judged.bands.find((b) => b.band.band === 1)!.variants[0]
    expect(b1.anchors.length).toBe(1)
    const scale = b1.sizeMM / 100
    // the cap spans y < 55·scale (y-down frame: the cap is the TOP band of the drawing)
    expect(b1.anchors[0].p[1]).toBeLessThan(55 * scale)
  })

  it('Grok · dumbbell: band 2 spans one anchor per lobe', { timeout: 300000 }, () => {
    const judged = solve(dumbbell())
    const b2 = judged.bands.find((b) => b.band.band === 2)!.variants[0]
    expect(b2.anchors.length).toBe(2)
    const scale = b2.sizeMM / 100
    const xs = b2.anchors.map((a) => a.p[0]).sort((a, b) => a - b)
    expect(xs[0]).toBeLessThan(40 * scale) // left lobe
    expect(xs[1]).toBeGreaterThan(60 * scale) // right lobe
  })

  it('R3-3 · symmetric square: byte-deterministic twice', { timeout: 300000 }, () => {
    const a = solve(rect(100, 100))
    const b = solve(rect(100, 100))
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
