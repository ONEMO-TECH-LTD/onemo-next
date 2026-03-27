import { NextResponse } from 'next/server'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const ASSETS_DIR = join(process.cwd(), 'public', 'assets')
const ALLOWED_EXTENSIONS: Record<'shapes' | 'materials' | 'env' | 'artwork', string[]> = {
  shapes: ['.glb', '.gltf'],
  materials: ['.png', '.jpg', '.jpeg', '.webp', '.avif'],
  env: ['.hdr', '.hdri', '.exr'],
  artwork: ['.png', '.jpg', '.jpeg', '.webp', '.avif'],
}
const MAX_FILE_SIZE_BYTES: Record<'shapes' | 'materials' | 'env' | 'artwork', number> = {
  shapes: 25 * 1024 * 1024,
  materials: 10 * 1024 * 1024,
  env: 50 * 1024 * 1024,
  artwork: 10 * 1024 * 1024,
}
const MATERIAL_SLOTS = new Set(['texture', 'normal', 'roughness', 'height', 'sheenColor'])

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

    if (!type || !['shapes', 'materials', 'env', 'artwork'].includes(type)) {
      return NextResponse.json({ error: 'type required (shapes|materials|env|artwork)' }, { status: 400 })
    }

    const assetType = type as 'shapes' | 'materials' | 'env' | 'artwork'

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (assetType === 'materials' && !folder) {
      return NextResponse.json({ error: 'materials uploads require a folder name' }, { status: 400 })
    }

    if (slot && assetType !== 'materials') {
      return NextResponse.json({ error: 'slot is only valid for materials uploads' }, { status: 400 })
    }

    if (slot && !MATERIAL_SLOTS.has(slot)) {
      return NextResponse.json({ error: 'Invalid material slot' }, { status: 400 })
    }

    if (!file.name) {
      return NextResponse.json({ error: 'Uploaded file must have a name' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE_BYTES[assetType]) {
      return NextResponse.json({ error: `File too large for ${assetType}` }, { status: 400 })
    }

    const ext = extname(file.name).toLowerCase()
    if (!ALLOWED_EXTENSIONS[assetType].includes(ext)) {
      return NextResponse.json({ error: `Unsupported file type for ${assetType}` }, { status: 400 })
    }

    const rawBaseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '-')
    const baseName = rawBaseName || `${assetType}-upload-${Date.now()}`
    const safeName = slot ? `${slot}${ext}` : `${baseName}${ext}`

    const safeFolder = folder?.replace(/[^a-zA-Z0-9_-]/g, '-')
    if (folder && !safeFolder) {
      return NextResponse.json({ error: 'Folder name is invalid after sanitization' }, { status: 400 })
    }

    const dir = safeFolder ? join(ASSETS_DIR, assetType, safeFolder) : join(ASSETS_DIR, assetType)
    await mkdir(dir, { recursive: true })

    const filePath = join(dir, safeName)
    let overwritten = false
    try {
      await access(filePath)
      overwritten = true
    } catch {
      overwritten = false
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const relativePath = safeFolder
      ? `/assets/${assetType}/${safeFolder}/${safeName}`
      : `/assets/${assetType}/${safeName}`

    return NextResponse.json({
      uploaded: safeName,
      path: relativePath,
      size: buffer.length,
      overwritten,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
