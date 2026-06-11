// draw module proofs (Run 9 engine) — recognizer accuracy with margin, no-match honesty,
// keep-raw fidelity (the wobble survives as true curves), all headless.

import { describe, test, expect } from 'vitest'
import { recognizeStroke, normalizeStroke, cloudDistance, libraryTemplates, vectoriseStroke, correctStroke, resampleStroke } from '../index'
import { flattenPath, flattenShape, signedArea, shapeBBox } from '@/lib/vector-core'
import { getShape } from '@/lib/shape-library'
import type { Vec2 } from '@/lib/vector-core'

/** A "hand-drawn" version of a library shape: its outline densified to finger-sampling density,
 *  plus deterministic jitter (polygons flatten to vertices only — a real finger emits ~100+ pts). */
function sloppy(kind: Parameters<typeof getShape>[0], jitter: number, seed = 7): Vec2[] {
  let s = seed
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2
  const ring = flattenPath(getShape(kind, 200, 200).paths[0], 0.5)
  const dense = resampleStroke([...ring, ring[0]], 160)
  return dense.map((p) => ({ x: p.x + rnd() * jitter, y: p.y + rnd() * jitter }))
}

describe('draw — $-family recognizer', () => {
  test('a sloppy heart snaps to THE heart, with margin over every other template', () => {
    const stroke = sloppy('heart', 3)
    const match = recognizeStroke(stroke, libraryTemplates())
    expect(match?.kind).toBe('heart')
    const cloud = normalizeStroke(stroke)
    const scores = libraryTemplates().map((t) => ({ kind: t.kind, d: cloudDistance(cloud, t.points) }))
    const heart = scores.find((x) => x.kind === 'heart')!
    const others = scores.filter((x) => x.kind !== 'heart').map((x) => x.d)
    expect(Math.min(...others)).toBeGreaterThan(heart.d * 1.3) // a real margin, not a coin flip
  })

  test('sloppy star and bolt land on their own templates', () => {
    expect(recognizeStroke(sloppy('star', 3), libraryTemplates())?.kind).toBe('star')
    expect(recognizeStroke(sloppy('bolt', 2.5), libraryTemplates())?.kind).toBe('bolt')
  })

  test('a stroke unlike any template is HONESTLY null — never a forced guess', () => {
    // a straight line is no closed silhouette — nothing in the library should claim it
    const line: Vec2[] = Array.from({ length: 60 }, (_, i) => ({ x: i * 3, y: i * 0.4 }))
    expect(recognizeStroke(line, libraryTemplates())).toBeNull()
  })
})

describe('draw — keep-raw vectorisation', () => {
  test('a wobbly square keeps its corners AND its area — the hand survives as true curves', () => {
    const stroke = sloppy('square', 2.2)
    const v = vectoriseStroke(stroke)
    expect(v).not.toBeNull()
    const anchors = v!.paths[0].anchors
    expect(anchors.length).toBeLessThan(40) // minimal anchors, not a point cloud
    expect(anchors.filter((a) => a.corner).length).toBeGreaterThanOrEqual(3) // drawn corners survive
    const area = Math.abs(signedArea(flattenShape(v!, 0.1)[0]))
    const trueArea = Math.abs(signedArea(flattenPath(getShape('square', 200, 200).paths[0], 0.1)))
    expect(area).toBeGreaterThan(trueArea * 0.9)
    expect(area).toBeLessThan(trueArea * 1.1)
  })

  test('intentional wobble is PRESERVED, not ironed flat', () => {
    // a wavy circle — the wave amplitude is design intent (8px on r=80)
    const wavy: Vec2[] = Array.from({ length: 200 }, (_, i) => {
      const t = (i / 200) * Math.PI * 2
      const r = 80 + 8 * Math.sin(7 * t)
      return { x: 100 + r * Math.cos(t), y: 100 + r * Math.sin(t) }
    })
    const v = vectoriseStroke(wavy)
    expect(v).not.toBeNull()
    const flat = flattenShape(v!, 0.05)[0]
    // radial spread of the fitted result keeps most of the 8px wave (a circle fit would collapse it)
    let minR = Infinity, maxR = -Infinity
    for (const p of flat) {
      const r = Math.hypot(p.x - 100, p.y - 100)
      if (r < minR) minR = r
      if (r > maxR) maxR = r
    }
    expect(maxR - minR).toBeGreaterThan(10) // ≥ ~70% of the 16px peak-to-peak intent
    const bb = shapeBBox(v!, 0.1)
    expect(bb.maxX - bb.minX).toBeGreaterThan(160)
  })

  test('too-short input is rejected, not mangled', () => {
    expect(vectoriseStroke([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBeNull()
  })
})

describe('draw — BEN-style correction (KAI-8949)', () => {
  test('a jittery hand comes out corrected-smooth: fewer anchors than the faithful fit, no kinks, area kept', () => {
    const stroke = sloppy('circle', 3.5) // a wobbly drawn circle — the bug-report case
    const faithful = vectoriseStroke(stroke)!
    const corrected = correctStroke(stroke)
    expect(corrected).not.toBeNull()
    const cAnchors = corrected!.paths[0].anchors
    expect(cAnchors.length).toBeLessThanOrEqual(faithful.paths[0].anchors.length) // imperfections removed
    expect(cAnchors.filter((a) => a.corner)).toHaveLength(0) // a circle-ish hand has no true corners
    const areaC = Math.abs(signedArea(flattenShape(corrected!, 0.1)[0]))
    const areaF = Math.abs(signedArea(flattenShape(faithful, 0.1)[0]))
    expect(areaC).toBeGreaterThan(areaF * 0.85) // corrected, not shrunken away
    expect(areaC).toBeLessThan(areaF * 1.15)
  })

  test('one drawing = ONE path, in both renderings', () => {
    const stroke = sloppy('heart', 3)
    expect(vectoriseStroke(stroke)!.paths).toHaveLength(1)
    expect(correctStroke(stroke)!.paths).toHaveLength(1)
  })
})
