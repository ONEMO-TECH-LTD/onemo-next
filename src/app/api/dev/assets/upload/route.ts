import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ASSETS_DIR = join(process.cwd(), 'public', 'assets')

// Upload a file to a specific asset folder
// POST /api/dev/assets/upload?type=shapes (or materials, env)
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')

    if (!type || !['shapes', 'materials', 'env'].includes(type)) {
      return NextResponse.json({ error: 'type required (shapes|materials|env)' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const dir = join(ASSETS_DIR, type)
    await mkdir(dir, { recursive: true })

    const filePath = join(dir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    return NextResponse.json({
      uploaded: safeName,
      path: `/assets/${type}/${safeName}`,
      size: buffer.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
