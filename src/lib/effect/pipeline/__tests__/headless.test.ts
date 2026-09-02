// T1 S4 — the browser-independence proof. This file runs in plain Node: no Worker, no DOM, no `self`.
// The same call the worker makes must answer identically here, and both shapes on the boundary must
// survive a JSON round trip exactly as the page constructs them.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { solveGrid } from '../solve'
import type { GridRequest } from '../types'
import { toPageModel } from '../../adapters/gridViewModel'
import { normMaskContour } from '../../grid-magnet-bridge'
import { PROTECTION_PADDING_MM } from '../../grid-magnet-spec'
import type { Contour } from '../../types'

const nodeRequire = createRequire(import.meta.url)
const AUTHORITY = JSON.parse(readFileSync(join(process.cwd(), 'src/lib/effect/__tests__/fixtures/balanced-manual-authority.json'), 'utf8')) as {
  fixtures: Array<{ id: string; asset: string; band: number }>
}
const cutout = (asset: string): Contour => {
  const { PNG } = nodeRequire('pngjs') as { PNG: { sync: { read(data: Buffer): { width: number; height: number; data: Uint8Array } } } }
  const png = PNG.sync.read(readFileSync(join(process.cwd(), asset)))
  const mask = new Uint8Array(png.width * png.height)
  for (let i = 0; i < mask.length; i++) if (png.data[i * 4 + 3] > 128) mask[i] = 1
  return normMaskContour(mask, png.width, png.height)!
}
const FOUR = ['duck-b3', 'bot-b4', 'batwoman-b3', 'butterfly-b2']
const requestFor = (id: string): GridRequest => {
  const fx = AUTHORITY.fixtures.find((f) => f.id === id)!
  return { base: cutout(fx.asset), offsetMM: 0, mode: fx.band, sizeMM: 0, stepSel: null,
    cfg: { pitchMM: 48, paddingMM: 12, perimeterOnly: true, centreMode: 2, governor: 0, plan: 'all6' },
    settings: { protectionPaddingMM: PROTECTION_PADDING_MM } }
}
const noFunctions = (v: unknown, path = '$'): string[] => {
  if (typeof v === 'function') return [path]
  if (v && typeof v === 'object') return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => noFunctions(x, path + '.' + k))
  return []
}

describe('the headless solve', () => {
  it('runs with no browser globals at all', () => {
    const g = globalThis as Record<string, unknown>
    for (const name of ['self', 'Worker', 'document', 'window', 'postMessage'])
      expect(g[name], name + ' must be absent in the Node proof').toBeUndefined()
  })

  it('request and result are plain data and survive a JSON round trip as constructed', () => {
    for (const id of FOUR) {
      const req = requestFor(id)
      expect(noFunctions(req), id + ' request carries a function').toEqual([])
      expect(JSON.parse(JSON.stringify(req)), id + ' request round trip').toEqual(req)
      const solve = solveGrid(req)
      expect(noFunctions(solve), id + ' result carries a function').toEqual([])
      expect(JSON.parse(JSON.stringify(solve)), id + ' result round trip').toEqual(solve)
    }
  }, 600000)

  it('answers exactly what the worker path posts — same offers, size, selection and evidence', async () => {
    const posted: Array<{ id: number; model: unknown }> = []
    const stub = { onmessage: null as ((e: { data: unknown }) => void) | null, postMessage: (m: unknown) => { posted.push(m as never) } }
    const g = globalThis as { self?: unknown }
    g.self = stub
    try {
      await import('@/app/(dev)/effect-creator/grid-centre/solve.worker')
      FOUR.forEach((id, i) => stub.onmessage!({ data: { id: i, ...requestFor(id) } }))
    } finally { delete g.self }
    FOUR.forEach((id, i) => {
      const direct = toPageModel(solveGrid(requestFor(id)))
      expect(JSON.parse(JSON.stringify(posted[i].model)), id).toEqual(JSON.parse(JSON.stringify(direct)))
    })
  }, 600000)
})
