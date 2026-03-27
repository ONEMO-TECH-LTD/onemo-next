import { NextResponse } from 'next/server'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ASSETS_DIR = join(process.cwd(), 'public', 'assets')
const MATERIAL_SLOT_PATTERNS: Array<[key: string, pattern: RegExp]> = [
  ['texture', /(base[\s_-]?color|albedo|diffuse|basecolor|color)/i],
  ['normal', /normal/i],
  ['roughness', /roughness/i],
  ['height', /(height|displacement|bump)/i],
  ['sheenColor', /sheen/i],
]

async function ensureAssetDir(type: string) {
  const dir = join(ASSETS_DIR, type)
  await mkdir(dir, { recursive: true })
  return dir
}

function inferMaterialTextures(type: string, entry: string, files: string[]) {
  const textures: Record<string, string> = {}

  for (const file of files) {
    for (const [slot, pattern] of MATERIAL_SLOT_PATTERNS) {
      if (!textures[slot] && pattern.test(file)) {
        textures[slot] = `/assets/${type}/${entry}/${file}`
        break
      }
    }
  }

  return textures
}

// List asset files by type
// GET /api/dev/assets?type=shapes     → GLB files
// GET /api/dev/assets?type=materials  → texture set folders (each containing maps)
// GET /api/dev/assets?type=env        → HDRI files (.exr, .hdr)
// GET /api/dev/assets?type=artwork    → uploaded artwork images
export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type')

  if (!type) {
    return NextResponse.json({ error: 'type parameter required (shapes|materials|env)' }, { status: 400 })
  }

  try {
    switch (type) {
      case 'shapes': {
        const dir = await ensureAssetDir(type)
        const files = await readdir(dir)
        const models = files
          .filter((f) => /\.(glb|gltf)$/i.test(f))
          .map((f) => ({
            name: f.replace(/\.(glb|gltf)$/i, '').replace(/[-_]/g, ' '),
            path: `/assets/${type}/${f}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ models })
      }

      case 'materials': {
        const dir = await ensureAssetDir(type)
        const entries = await readdir(dir)
        const sets = []
        for (const entry of entries) {
          const entryPath = join(dir, entry)
          const info = await stat(entryPath)
          if (info.isDirectory()) {
            const texFiles = await readdir(entryPath)
            const textures = inferMaterialTextures(type, entry, texFiles)
            sets.push({ name: entry, path: `/assets/${type}/${entry}`, textures })
          }
        }
        return NextResponse.json({ materials: sets.sort((a, b) => a.name.localeCompare(b.name)) })
      }

      case 'env': {
        const dir = await ensureAssetDir(type)
        const files = await readdir(dir)
        const hdris = files
          .filter((f) => /\.(exr|hdr|hdri)$/i.test(f))
          .map((f) => ({
            name: f.replace(/\.(exr|hdr|hdri)$/i, '').replace(/[-_]/g, ' '),
            path: `/assets/${type}/${f}`,
            ext: extname(f).slice(1),
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ hdris })
      }

      case 'artwork': {
        const dir = await ensureAssetDir(type)
        const files = await readdir(dir)
        const artworks = files
          .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f))
          .map((f) => ({
            name: f.replace(/\.(png|jpe?g|webp|avif)$/i, '').replace(/[-_]/g, ' '),
            path: `/assets/${type}/${f}`,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return NextResponse.json({ artworks })
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: `Directory not found: ${type}` }, { status: 404 })
  }
}
