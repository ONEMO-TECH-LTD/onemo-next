import { readFileSync, writeFileSync } from 'node:fs'
import { scaleToSize } from '../../../src/lib/grid-engine/candidates'
import { discFitsGrid, prepareOutline } from '../../../src/lib/grid-engine/measure'
import { RELEASED } from '../../../src/lib/grid-engine/spec'

const outline = readFileSync('/tmp/bat-pts.txt', 'utf8')
  .trim()
  .split(/\s+/)
  .map((p) => {
    const [x, y] = p.split(',').map(Number)
    return [x, y] as [number, number]
  })

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

function cellsAt(size: number) {
  const prep = prepareOutline(thin(scaleToSize(outline, size)))
  const x0 = Math.ceil(Number(prep.minX) / 1000)
  const x1 = Math.floor(Number(prep.maxX) / 1000)
  const y0 = Math.ceil(Number(prep.minY) / 1000)
  const y1 = Math.floor(Number(prep.maxY) / 1000)
  const out: Array<[number, number]> = []
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (discFitsGrid(prep, [x, y], RELEASED.grid)) out.push([x, y])
    }
  }
  return out
}

const lines: string[] = []
for (const size of [84, 86, 88, 90, 92, 96, 100]) {
  const cells = cellsAt(size)
  const set = new Set(cells.map(([x, y]) => `${x},${y}`))
  let vert = 0
  let diag = 0
  let horiz = 0
  let bestVert: [number, number] | null = null
  for (const [x, y] of cells) {
    if (set.has(`${x},${y + 48}`)) {
      vert++
      if (!bestVert) bestVert = [x, y]
    }
    if (set.has(`${x + 48},${y}`)) horiz++
    if (set.has(`${x + 48},${y + 48}`)) diag++
  }
  lines.push(
    `size ${size} cells=${cells.length} vert48=${vert} horiz48=${horiz} diag48=${diag} firstVert=${bestVert}`,
  )
}

const text = lines.join('\n')
writeFileSync('/tmp/probe-1mm-pair.txt', text)
console.log(text)
