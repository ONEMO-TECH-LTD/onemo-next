// /api/dev/originals — preserve-at-INGEST (REBUILD-PLAN-v2 §B5, Dan's quality directive #4):
// the user's ORIGINAL untouched file is persisted the moment it enters the creator — before any
// processing, before any save — so the manufacturing track always has the full-resolution source
// (1200-DPI-grade printing needs the real bytes, not a GPU-sized derivative). Content-hash keyed:
// re-uploads of the same photo are idempotent. Dev-grade channel (same class as the old
// factory-renders sink); production = Cloudinary originals (§8.7b), later.

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

const DIR = path.join(process.cwd(), '.dev-originals')

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ saved: false, error: 'no file' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const dest = path.join(DIR, `${sha256}.${ext}`)
    await mkdir(DIR, { recursive: true })
    const exists = await access(dest).then(() => true).catch(() => false)
    if (!exists) await writeFile(dest, bytes)
    return NextResponse.json({ saved: true, sha256, path: dest, bytes: bytes.length, deduped: exists })
  } catch (e) {
    return NextResponse.json({ saved: false, error: (e as Error)?.message ?? 'write failed' }, { status: 500 })
  }
}
