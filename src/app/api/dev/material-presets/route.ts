import { access, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import type { MaterialPresetConfig } from '@/app/(dev)/prototype/types'
import { collectMaterialPresetAssetPaths, sanitizeMaterialPresetName, validateMaterialPresetConfig } from './schema'

const MATERIAL_PRESETS_DIR = join(process.cwd(), 'data', 'material-presets')
const PUBLIC_DIR = join(process.cwd(), 'public')

async function findMissingAssetPaths(paths: string[]) {
  const missing: string[] = []

  for (const assetPath of paths) {
    const diskPath = join(PUBLIC_DIR, assetPath.replace(/^\/+/, ''))
    try {
      await access(diskPath)
    } catch {
      missing.push(assetPath)
    }
  }

  return missing
}

export async function GET() {
  try {
    await mkdir(MATERIAL_PRESETS_DIR, { recursive: true })
    const files = await readdir(MATERIAL_PRESETS_DIR)
    const presetFiles = files.filter((file) => file.endsWith('.json'))
    const entries = await Promise.all(
      presetFiles.map(async (file) => {
        const info = await stat(join(MATERIAL_PRESETS_DIR, file))
        return {
          name: file.replace('.json', ''),
          modified: info.mtime.toISOString(),
        }
      }),
    )

    entries.sort((a, b) => a.name.localeCompare(b.name))
    return NextResponse.json({ presets: entries.map((entry) => entry.name), entries })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await mkdir(MATERIAL_PRESETS_DIR, { recursive: true })
    const config = await req.json()

    if (!validateMaterialPresetConfig(config)) {
      return NextResponse.json({ error: 'Invalid material preset payload' }, { status: 400 })
    }

    const safeName = sanitizeMaterialPresetName(config.name)
    if (!safeName) {
      return NextResponse.json({ error: 'Valid preset name required' }, { status: 400 })
    }

    const normalizedConfig: MaterialPresetConfig = {
      ...config,
      name: safeName,
      modified: new Date().toISOString(),
    }

    const missingAssetPaths = await findMissingAssetPaths(collectMaterialPresetAssetPaths(normalizedConfig))
    if (missingAssetPaths.length > 0) {
      return NextResponse.json(
        { error: 'Material preset references missing asset paths', missingAssetPaths },
        { status: 400 },
      )
    }

    const filePath = join(MATERIAL_PRESETS_DIR, `${safeName}.json`)
    await writeFile(filePath, JSON.stringify(normalizedConfig, null, 2))
    return NextResponse.json({ saved: safeName, preset: normalizedConfig })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
