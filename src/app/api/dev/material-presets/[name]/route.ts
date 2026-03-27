import { access, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { collectMaterialPresetAssetPaths, sanitizeMaterialPresetName, validateMaterialPresetConfig } from '../schema'

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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params
    const safeName = sanitizeMaterialPresetName(name)
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid preset name' }, { status: 400 })
    }

    const filePath = join(MATERIAL_PRESETS_DIR, `${safeName}.json`)
    const content = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content)

    if (!validateMaterialPresetConfig(parsed)) {
      return NextResponse.json({ error: 'Material preset file has invalid schema' }, { status: 500 })
    }

    const missingAssetPaths = await findMissingAssetPaths(collectMaterialPresetAssetPaths(parsed))
    if (missingAssetPaths.length > 0) {
      return NextResponse.json(
        { error: 'Material preset file references missing asset paths', missingAssetPaths },
        { status: 500 },
      )
    }

    return NextResponse.json(parsed)
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Material preset file is corrupted' }, { status: 500 })
    }

    return NextResponse.json({ error: 'Material preset not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params
    const safeName = sanitizeMaterialPresetName(name)
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid preset name' }, { status: 400 })
    }

    const filePath = join(MATERIAL_PRESETS_DIR, `${safeName}.json`)
    await unlink(filePath)
    return NextResponse.json({ deleted: safeName })
  } catch {
    return NextResponse.json({ error: 'Material preset not found' }, { status: 404 })
  }
}
