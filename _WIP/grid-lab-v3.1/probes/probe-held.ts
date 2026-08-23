import { readFileSync, writeFileSync } from 'node:fs'
import { scaleToSize } from '../../../src/lib/grid-engine/candidates'
import { discFitsGrid, prepareOutline } from '../../../src/lib/grid-engine/measure'
import { magnetsInRegion } from '../../../src/lib/grid-engine/engine'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

const outline = readFileSync('/tmp/bat-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

const spec = RELEASED
const pitch = spec.grid.basePitchMM
const pad = spec.grid.paddingMM
const half = ((spec.grid.positionsPerAxis - 1) * pitch) / 2
const field = { x: -half, y: -half, w: half * 2, h: half * 2 }

function thin(verts: Array<[number, number]>) {
  const min2 = 1
  const out: Array<[number, number]> = []
  for (const p of verts) {
    const last = out[out.length - 1]
    if (last) {
      const dx = p[0] - last[0]
      const dy = p[1] - last[1]
      if (dx * dx + dy * dy < min2) continue
    }
    out.push(p)
  }
  return out.length >= 3 ? out : verts
}

const lines: string[] = []
for (const size of [120, 132, 144, 156, 168]) {
  const prep = prepareOutline(thin(scaleToSize(outline, size)))
  lines.push(`\nSIZE ${size} bbox ${Number(prep.minX) / 1000},${Number(prep.minY) / 1000} .. ${Number(prep.maxX) / 1000},${Number(prep.maxY) / 1000}`)
  for (let ox = 0; ox < pitch; ox += pad) {
    for (let oy = 0; oy < pitch; oy += pad) {
      const raw = magnetsInRegion({ ...spec.grid, pitchMM: pitch }, field, 0, [ox, oy])
      const held = raw.filter(([x, y]) => discFitsGrid(prep, [x, y], spec.grid))
      if (held.length < 2) continue
      const ys = held.map((p) => p[1])
      const mid = (Math.min(...ys) + Math.max(...ys)) / 2
      const top = held.filter((p) => p[1] <= mid)
      const bot = held.filter((p) => p[1] > mid)
      const spanX = Math.max(...held.map((p) => p[0])) - Math.min(...held.map((p) => p[0]))
      const spanY = Math.max(...ys) - Math.min(...ys)
      lines.push(
        `  o(${ox},${oy}) n=${held.length} span ${spanX}x${spanY} top=${top.length} bot=${bot.length} ${held.map(([x, y]) => `(${x},${y})`).join(' ')}`,
      )
    }
  }
}

const text = lines.join('\n')
writeFileSync('/tmp/probe-held.txt', text)
console.log(text)
