/**
 * react-figma engine · E3.5 — image asset upload (creation tools).
 * POST multipart {file} → save under public/uploads/react-figma/<safe-name> →
 * { path } (web path). Jailed to that dir; collision-safe suffix. Dev-only.
 * The Image-insert primitive uploads here, then splices `<img src=path>` via
 * insert-jsx-child. Keeps uploaded assets out of the 3D-studio asset routes.
 */
import { NextResponse } from 'next/server'
import { writeFile, mkdir, access } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'react-figma')
// Raster only. .svg is deliberately excluded — an uploaded SVG served same-origin from public/
// is a stored-XSS vector (can carry <script>); supporting it safely needs server-side sanitization.
const OK_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'])

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required (multipart)' }, { status: 400 })
    }
    const ext = extname(file.name).toLowerCase()
    if (!OK_EXT.has(ext)) {
      return NextResponse.json({ error: `unsupported image type "${ext}"` }, { status: 422 })
    }
    // sanitize base, strip any path segments, collision-safe
    const base = basename(file.name, extname(file.name)).replace(/[^a-z0-9._-]/gi, '-').toLowerCase() || 'image'
    await mkdir(UPLOAD_DIR, { recursive: true })
    let name = `${base}${ext}`, n = 1
    while (true) {
      try { await access(join(UPLOAD_DIR, name)); name = `${base}-${++n}${ext}` } catch { break }
    }
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(join(UPLOAD_DIR, name), buf)
    return NextResponse.json({ path: `/uploads/react-figma/${name}`, size: buf.length })
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
