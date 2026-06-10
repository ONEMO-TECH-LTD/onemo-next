// Dev API — render-factory auto-save (blueprint §8 Phase 2: "auto-saved to folders for quality
// inspection"). Writes each factory set to `.dev-factory-renders/<payload_hash>/<angle>.png` at the
// repo root (gitignored). Dev-only: refuses outside development.

import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

interface FactoryRenderBody {
  payload_hash: string
  renders: { angle: string; dataUrl: string }[]
}

const OUT_ROOT = path.join(process.cwd(), '.dev-factory-renders')
const SAFE = /^[a-z0-9_-]+$/i

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ saved: false, error: 'dev-only endpoint' }, { status: 403 })
  }
  let body: FactoryRenderBody
  try {
    body = (await req.json()) as FactoryRenderBody
  } catch {
    return NextResponse.json({ saved: false, error: 'bad json' }, { status: 400 })
  }
  const hash = (body.payload_hash || 'unhashed').slice(0, 32)
  if (!SAFE.test(hash)) return NextResponse.json({ saved: false, error: 'bad hash' }, { status: 400 })

  const dir = path.join(OUT_ROOT, hash)
  await mkdir(dir, { recursive: true })
  let written = 0
  for (const r of body.renders ?? []) {
    if (!SAFE.test(r.angle)) continue
    const m = /^data:image\/png;base64,(.+)$/.exec(r.dataUrl || '')
    if (!m) continue
    await writeFile(path.join(dir, `${r.angle}.png`), Buffer.from(m[1], 'base64'))
    written++
  }
  return NextResponse.json({ saved: written > 0, dir: path.relative(process.cwd(), dir), written })
}
