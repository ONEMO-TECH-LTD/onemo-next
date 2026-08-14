import { describe, it } from 'vitest'
import sharp from 'sharp'
import { traceContourRaw } from './src/lib/effect/contour'
import { buildKernelRequest } from './src/lib/grid-engine/compute/candidates'
import { measureLattice } from './src/lib/grid-engine/compute/magnetic-grid-measurement-kernel/dist/index.js'
import { RELEASED, RELEASED_ARRANGEMENT_GRAMMAR } from './src/lib/grid-engine/spec'

const lines: string[] = []
const say = (s: string) => { lines.push(s); process.stderr.write(s + '\n') }

describe('raw-set completeness', () => {
  it('duck across sizes and lattice offsets', async () => {
    const img = sharp('public/grid-engine/cutouts/DUCK.png')
    const m = await img.metadata()
    const w = m.width!, h = m.height!
    const { data } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const mask = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) mask[i] = data[i * 4 + 3] > 128 ? 1 : 0
    const ring = traceContourRaw(mask, w, h)!
    say(`duck: ${ring.length} ring points, image ${w}x${h}`)

    for (const sizeMM of [60, 72, 120]) {
      const base = buildKernelRequest({
        ring: { points: ring as ReadonlyArray<readonly [number, number]>, width: w, height: h },
        spec: RELEASED, sizeMM,
        grammar: RELEASED_ARRANGEMENT_GRAMMAR as never,
      })
      const asBuilt = measureLattice(base).sizes[0]!.positions.filter(p => p.fits).length
      let best = { held: 0, ox: 0, oy: 0 }, anyCount = 0
      for (let ox = 0; ox < 48; ox += 4) for (let oy = 0; oy < 48; oy += 4) {
        const req = { ...base, parameters: { ...base.parameters, lattice: { ...base.parameters.lattice,
          origin: { x: { numerator: BigInt(ox), denominator: BigInt(1) },
                    y: { numerator: BigInt(oy), denominator: BigInt(1) } } } } }
        const held = measureLattice(req).sizes[0]!.positions.filter(p => p.fits).length
        if (held > 0) anyCount++
        if (held > best.held) best = { held, ox, oy }
      }
      say(`${sizeMM}mm | bridge asks ONE state -> ${asBuilt} held | sweeping 144 offsets -> ${anyCount} offsets hold something, best ${best.held} at (${best.ox},${best.oy})mm`)
    }
  }, 300000)
})
