import { describe, expect, it } from 'vitest'

import {
  resolveTraceOutline,
  type TraceOutlineInput,
  type TraceOutlineSettings,
} from '@/app/(dev)/effect-creator/v5.3.1/user/editor/producers'
import type { VShape } from '@/lib/vector-core'

const vectorShape: VShape = {
  paths: [{
    anchors: [
      { p: { x: 10, y: 90 }, hIn: null, hOut: null, corner: true },
      { p: { x: 30, y: 91 }, hIn: null, hOut: null, corner: false },
      { p: { x: 50, y: 92 }, hIn: null, hOut: null, corner: true },
      { p: { x: 70, y: 91 }, hIn: null, hOut: null, corner: false },
      { p: { x: 90, y: 90 }, hIn: null, hOut: null, corner: true },
      { p: { x: 91, y: 70 }, hIn: null, hOut: null, corner: false },
      { p: { x: 92, y: 50 }, hIn: null, hOut: null, corner: true },
      { p: { x: 91, y: 30 }, hIn: null, hOut: null, corner: false },
      { p: { x: 90, y: 10 }, hIn: null, hOut: null, corner: true },
      { p: { x: 70, y: 9 }, hIn: null, hOut: null, corner: false },
      { p: { x: 50, y: 8 }, hIn: null, hOut: null, corner: true },
      { p: { x: 30, y: 9 }, hIn: null, hOut: null, corner: false },
      { p: { x: 10, y: 10 }, hIn: null, hOut: null, corner: true },
      { p: { x: 9, y: 30 }, hIn: null, hOut: null, corner: false },
      { p: { x: 8, y: 50 }, hIn: null, hOut: null, corner: true },
      { p: { x: 9, y: 70 }, hIn: null, hOut: null, corner: false },
    ],
  }],
}
const input: TraceOutlineInput = {
  vectorShape,
  rawTracePx: [
    [10, 10], [30, 9], [50, 8], [70, 9],
    [90, 10], [91, 30], [92, 50], [91, 70],
    [90, 90], [70, 91], [50, 92], [30, 91],
    [10, 90], [9, 70], [8, 50], [9, 30],
  ],
  maskWidthPx: 100,
  maskHeightPx: 100,
  mmPerPx: 1,
}
const OFF: TraceOutlineSettings = {
  detail: 100,
  offset: 0,
  offsetJoin: 'sharp',
  radius: 0,
  curve: 0,
  simplify: 0,
  smooth: 0,
  straighten: 0,
}

function bounds(shape: VShape) {
  const points = shape.paths.flatMap((path) => path.anchors.map((anchor) => anchor.p))
  return {
    minX: Math.min(...points.map(({ x }) => x)),
    maxX: Math.max(...points.map(({ x }) => x)),
  }
}

describe('grid-lab v5.3.1 outline-control binding', () => {
  it('preserves the born vector exactly while every control is at its reflected default', () => {
    const resolved = resolveTraceOutline(input, OFF)

    expect(resolved).toBe(vectorShape)
  })

  it('routes all seven generation and whole-outline controls through the existing v5 engine', () => {
    const baseline = JSON.stringify(resolveTraceOutline(input, OFF))
    const offset = resolveTraceOutline(input, { ...OFF, offset: 10, offsetJoin: 'round' })
    const changed = [
      ['detail', resolveTraceOutline(input, { ...OFF, detail: 50 })],
      ['radius', resolveTraceOutline(input, { ...OFF, radius: 50 })],
      ['curve', resolveTraceOutline(input, { ...OFF, curve: 50 })],
      ['simplify', resolveTraceOutline(input, { ...OFF, simplify: 50 })],
      ['smooth', resolveTraceOutline(input, { ...OFF, smooth: 60 })],
      ['straighten', resolveTraceOutline(input, { ...OFF, straighten: 50 })],
    ] as const

    expect(offset).not.toBeNull()
    expect(bounds(offset!).minX).toBeLessThan(bounds(vectorShape).minX)
    expect(bounds(offset!).maxX).toBeGreaterThan(bounds(vectorShape).maxX)
    for (const [control, shape] of changed) {
      expect(shape, `${control} must return an outline`).not.toBeNull()
      expect(JSON.stringify(shape), `${control} must change the outline`).not.toBe(baseline)
    }
  })
})
