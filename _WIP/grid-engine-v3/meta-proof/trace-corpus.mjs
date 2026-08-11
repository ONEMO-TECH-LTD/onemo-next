// META EVIDENCE — trace the seven frozen cut-outs to millimetre-free outline polygons.
//
// Independent of Lead's harness and of the bench code: PNG is decoded here, the alpha mask is
// walked here, and the contour is produced here. That independence is the point — the count table
// is evidence for a Dan ruling, so it must not inherit the implementation it is measuring.
//
// Output: one JSON per shape, { name, sha256, wPx, hPx, points: [[x,y]...] } in pixel units.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Minimal PNG decoder: non-interlaced, 8-bit, colour types 2 (RGB) and 6 (RGBA). */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let pos = 8
  let w = 0, h = 0, bitDepth = 0, colourType = 0, interlace = 0
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      bitDepth = data[8]; colourType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
  if (interlace !== 0) throw new Error('interlaced PNG unsupported')
  const channels = colourType === 6 ? 4 : colourType === 2 ? 3 : 0
  if (!channels) throw new Error(`unsupported colour type ${colourType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = w * channels
  const out = Buffer.alloc(h * stride)
  let rp = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++]
    const line = raw.subarray(rp, rp + stride); rp += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= channels ? prev[i - channels] : 0
      const x = line[i]
      let v
      switch (filter) {
        case 0: v = x; break
        case 1: v = x + a; break
        case 2: v = x + b; break
        case 3: v = x + ((a + b) >> 1); break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
          break
        }
        default: throw new Error(`bad filter ${filter}`)
      }
      cur[i] = v & 0xff
    }
  }
  return { w, h, channels, pixels: out }
}

/** Alpha mask at a threshold; RGB images (no alpha) are rejected — a cut-out must have transparency. */
function alphaMask({ w, h, channels, pixels }) {
  if (channels !== 4) return null
  const mask = new Uint8Array(w * h)
  let opaque = 0
  for (let i = 0; i < w * h; i++) {
    if (pixels[i * 4 + 3] > 128) { mask[i] = 1; opaque++ }
  }
  if (opaque === 0 || opaque > w * h * 0.995) return null
  return { mask, opaque }
}

/** Largest 4-connected component, so a stray speck cannot become the shape. */
function largestComponent(mask, w, h) {
  const label = new Int32Array(w * h).fill(-1)
  let best = -1, bestSize = 0, next = 0
  const stack = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || label[s] !== -1) continue
    const id = next++
    let sp = 0, size = 0
    stack[sp++] = s; label[s] = id
    while (sp) {
      const p = stack[--sp]; size++
      const x = p % w, y = (p / w) | 0
      const push = (q) => { if (q >= 0 && q < w * h && mask[q] && label[q] === -1) { label[q] = id; stack[sp++] = q } }
      if (x > 0) push(p - 1)
      if (x < w - 1) push(p + 1)
      if (y > 0) push(p - w)
      if (y < h - 1) push(p + w)
    }
    if (size > bestSize) { bestSize = size; best = id }
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) if (label[i] === best) out[i] = 1
  return { mask: out, size: bestSize }
}

/** Moore-neighbour boundary trace of the filled mask, clockwise, closed ring. */
function traceBoundary(mask, w, h) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x])
  let sx = -1, sy = -1
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { sx = x; sy = y; break outer }
  if (sx < 0) return null
  const N = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]
  const ring = []
  let cx = sx, cy = sy, dir = 6
  const startX = sx, startY = sy
  let guard = 0
  do {
    ring.push([cx, cy])
    let found = false
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8
      const nx = cx + N[d][0], ny = cy + N[d][1]
      if (at(nx, ny)) { cx = nx; cy = ny; dir = d; found = true; break }
    }
    if (!found) break
    if (++guard > 8 * w * h) throw new Error('boundary walk did not close')
  } while (!(cx === startX && cy === startY))
  return ring
}

/** Douglas–Peucker, tolerance in pixels — reduces point count without moving the shape beyond tol. */
function simplify(points, tol) {
  if (points.length < 3) return points
  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]
  const d2 = (p, a, b) => {
    const vx = b[0] - a[0], vy = b[1] - a[1]
    const wx = p[0] - a[0], wy = p[1] - a[1]
    const L = vx * vx + vy * vy
    const t = L === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / L))
    const dx = p[0] - (a[0] + t * vx), dy = p[1] - (a[1] + t * vy)
    return dx * dx + dy * dy
  }
  while (stack.length) {
    const [i, j] = stack.pop()
    let far = -1, fd = tol * tol
    for (let k = i + 1; k < j; k++) {
      const d = d2(points[k], points[i], points[j])
      if (d > fd) { fd = d; far = k }
    }
    if (far > 0) { keep[far] = 1; stack.push([i, far], [far, j]) }
  }
  return points.filter((_, i) => keep[i])
}

const files = readdirSync(HERE).filter((f) => f.endsWith('.png')).sort()
const out = []
for (const f of files) {
  const buf = readFileSync(join(HERE, f))
  const sha = createHash('sha256').update(buf).digest('hex').slice(0, 16)
  const img = decodePNG(buf)
  const m = alphaMask(img)
  if (!m) { out.push({ name: f, sha256: sha, error: 'no transparency — not a cut-out' }); continue }
  const comp = largestComponent(m.mask, img.w, img.h)
  const ring = traceBoundary(comp.mask, img.w, img.h)
  const pts = simplify(ring, 1.0)
  out.push({ name: f.replace('.png', ''), sha256: sha, wPx: img.w, hPx: img.h, opaquePx: m.opaque, componentPx: comp.size, rawPoints: ring.length, points: pts })
  console.log(`${f}: ${img.w}x${img.h}, opaque ${m.opaque}, component ${comp.size}, ring ${ring.length} -> ${pts.length} pts, sha ${sha}`)
}
writeFileSync(join(HERE, 'corpus-outlines.json'), JSON.stringify(out))
console.log('\nwrote corpus-outlines.json')
