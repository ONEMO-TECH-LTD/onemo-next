import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const ASSETS_DIR = join(process.cwd(), 'public', 'assets')

// Upload a file to a specific asset folder
// POST /api/dev/assets/upload?type=shapes (or materials, env)
// Optional: &folder=custom-set (creates subfolder inside type dir)
// Optional: &slot=normal|roughness|height|sheen (renames file to match slot)
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const type = url.searchParams.get('type')
    const folder = url.searchParams.get('folder')
    const slot = url.searchParams.get('slot')

    if (!type || !['shapes', 'materials', 'env'].includes(type)) {
      return NextResponse.json({ error: 'type required (shapes|materials|env)' }, { status: 400 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Sanitize filename — if slot is provided, prefix with slot name for discovery
    const ext = file.name.substring(file.name.lastIndexOf('.'))
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-')
    const safeName = slot ? `${slot}${ext}` : `${baseName}${ext}`

    // Build directory path — optionally nested in a subfolder
    const safeFolder = folder?.replace(/[^a-zA-Z0-9_-]/g, '-')
    const dir = safeFolder ? join(ASSETS_DIR, type, safeFolder) : join(ASSETS_DIR, type)
    await mkdir(dir, { recursive: true })

    const filePath = join(dir, safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const relativePath = safeFolder
      ? `/assets/${type}/${safeFolder}/${safeName}`
      : `/assets/${type}/${safeName}`

    return NextResponse.json({
      uploaded: safeName,
      path: relativePath,
      size: buffer.length,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
