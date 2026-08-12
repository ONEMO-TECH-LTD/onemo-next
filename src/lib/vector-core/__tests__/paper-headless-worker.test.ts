// @vitest-environment node
//
// KAI-9072 (L0 acceptance proof): "confirm Paper runs headless in our Web Worker (no DOM)."
// This file runs in the NODE environment (no jsdom) — the same no-DOM constraint a Web Worker has.
// It proves the Paper geometry kernel (round / smooth / simplify) produces valid geometry with no
// `document`/`window` present, so it is safe to call from the worker/headless path.

import { describe, test, expect } from 'vitest'
import { roundCornersPaper, smoothPaper, simplifyPaper, subtractShapePaper } from '../paper-kernel'
import type { VPath, VShape } from '../index'

const square: VPath = {
  anchors: [
    { p: { x: 0, y: 0 }, hIn: null, hOut: null, corner: true },
    { p: { x: 100, y: 0 }, hIn: null, hOut: null, corner: true },
    { p: { x: 100, y: 100 }, hIn: null, hOut: null, corner: true },
    { p: { x: 0, y: 100 }, hIn: null, hOut: null, corner: true },
  ],
}
const finite = (p: VPath) => p.anchors.length > 0 && p.anchors.every((a) => Number.isFinite(a.p.x) && Number.isFinite(a.p.y))

describe('KAI-9072 — Paper kernel runs HEADLESS (no DOM) as the Web Worker requires', () => {
  test('the test environment has NO document/window (the worker constraint)', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  test('roundCornersPaper produces a valid, finite, arc-extended path with no DOM', () => {
    const rounded = roundCornersPaper(square, 20, () => true)
    expect(rounded.anchors.length).toBeGreaterThan(square.anchors.length) // corners → arc anchors
    expect(finite(rounded)).toBe(true)
  })

  test('smoothPaper + simplifyPaper produce valid finite geometry with no DOM', () => {
    expect(finite(smoothPaper(square, 0.6))).toBe(true)
    expect(finite(simplifyPaper(square, 1))).toBe(true)
  })

  test('local subtraction preserves untouched anchors and Bezier handles', () => {
    const subject: VShape = { paths: [{ anchors: [
      { id: 'top-left', p: { x: 0, y: 0 }, hIn: { x: 0, y: 25 }, hOut: { x: 25, y: 0 }, corner: false },
      { id: 'top-right', p: { x: 100, y: 0 }, hIn: { x: 75, y: 0 }, hOut: { x: 100, y: 25 }, corner: false },
      { id: 'bottom-right', p: { x: 100, y: 100 }, hIn: { x: 100, y: 75 }, hOut: { x: 75, y: 100 }, corner: false },
      { id: 'bottom-left', p: { x: 0, y: 100 }, hIn: { x: 25, y: 100 }, hOut: { x: 0, y: 75 }, corner: false },
    ] }] }
    const negative: VShape = { paths: [{ anchors: [
      { p: { x: 80, y: 35 }, hIn: null, hOut: null, corner: true },
      { p: { x: 120, y: 35 }, hIn: null, hOut: null, corner: true },
      { p: { x: 120, y: 65 }, hIn: null, hOut: null, corner: true },
      { p: { x: 80, y: 65 }, hIn: null, hOut: null, corner: true },
    ] }] }

    const carved = subtractShapePaper(subject, negative)

    expect(carved?.paths).toHaveLength(1)
    expect(carved?.paths[0].anchors.find((anchor) => anchor.id === 'top-left')).toEqual(subject.paths[0].anchors[0])
    expect(carved?.paths[0].anchors.find((anchor) => anchor.id === 'bottom-left')).toEqual(subject.paths[0].anchors[3])
  })

  test('keeps one main blob after a local shave but rejects a destructive split', () => {
    const shape = (x0: number, y0: number, x1: number, y1: number): VShape => ({ paths: [{ anchors: [
      { p: { x: x0, y: y0 }, hIn: null, hOut: null, corner: true },
      { p: { x: x1, y: y0 }, hIn: null, hOut: null, corner: true },
      { p: { x: x1, y: y1 }, hIn: null, hOut: null, corner: true },
      { p: { x: x0, y: y1 }, hIn: null, hOut: null, corner: true },
    ] }] })
    const subject = shape(0, 0, 100, 100)

    expect(subtractShapePaper(subject, shape(80, -10, 90, 110))?.paths).toHaveLength(1)
    expect(subtractShapePaper(subject, shape(49, -10, 51, 110))).toBeNull()
  })
})
