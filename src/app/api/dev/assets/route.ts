import { NextResponse } from 'next/server'
import { readdir, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const ASSETS_DIR = join(process.cwd(), 'public', 'assets')

// List asset files by type
// GET /api/dev/assets?type=shapes     → GLB files
// GET /api/dev/assets?type=materials  → texture set folders (each containing maps)
// GET /api/dev/assets?type=env        → HDRI files (.exr, .hdr)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type')

  if (!type) {
    return NextResponse.json({ error: 'type parameter required (shapes|materials|env)' }, { status: 400 })
  }

  try {
    const dir = join(ASSETS_DIR, type)

    switch (type) {
      case 'shapes': {
        // List GLB/GLTF files
        const files = await readdir(dir)
        const models = files
          .filter((f) => /\.(glb|gltf)$/i.test(f))
          .map((f) => ({
            name: f.replace(/\.(glb|gltf)$/i, '').replace(/[-_]/g, ' '),
            path: `/assets/${type}/${f}`,
          }))
        return NextResponse.json({ models })
      }

      case 'materials': {
        // List texture set directories (each folder = one material set)
        const entries = await readdir(dir)
        const sets = []
        for (const entry of entries) {
          const entryPath = join(dir, entry)
          const info = await stat(entryPath)
          if (info.isDirectory()) {
            // List texture files in this set
            const texFiles = await readdir(entryPath)
            const textures: Record<string, string> = {}
            for (const tf of texFiles) {
              const base = tf.toLowerCase()
              if (base.includes('normal')) textures.normal = `/assets/${type}/${entry}/${tf}`
              else if (base.includes('roughness')) textures.roughness = `/assets/${type}/${entry}/${tf}`
              else if (base.includes('height') || base.includes('displacement') || base.includes('bump')) textures.height = `/assets/${type}/${entry}/${tf}`
              else if (base.includes('sheen')) textures.sheenColor = `/assets/${type}/${entry}/${tf}`
            }
            sets.push({ name: entry, path: `/assets/${type}/${entry}`, textures })
          }
        }
        return NextResponse.json({ materials: sets })
      }

      case 'env': {
        // List HDRI/EXR files
        const files = await readdir(dir)
        const hdris = files
          .filter((f) => /\.(exr|hdr|hdri)$/i.test(f))
          .map((f) => ({
            name: f.replace(/\.(exr|hdr|hdri)$/i, '').replace(/[-_]/g, ' '),
            path: `/assets/${type}/${f}`,
            ext: extname(f).slice(1),
          }))
        return NextResponse.json({ hdris })
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: `Directory not found: ${type}` }, { status: 404 })
  }
}
