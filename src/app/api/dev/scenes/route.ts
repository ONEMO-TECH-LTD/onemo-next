import { NextResponse } from 'next/server'
import { readdir, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SCENES_DIR = join(process.cwd(), 'data', 'scenes')

export async function GET() {
  try {
    await mkdir(SCENES_DIR, { recursive: true })
    const files = await readdir(SCENES_DIR)
    const scenes = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
    return NextResponse.json({ scenes })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await mkdir(SCENES_DIR, { recursive: true })
    const config = await req.json()
    const name = config.name
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-')
    const filePath = join(SCENES_DIR, `${safeName}.json`)
    await writeFile(filePath, JSON.stringify(config, null, 2))
    return NextResponse.json({ saved: safeName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
