import { NextResponse } from 'next/server'
import { readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const APP_SCENES_DIR = join(process.cwd(), 'data', 'scenes')
const STUDIO_SCENES_DIR = join(process.cwd(), 'studio', 'data', 'scenes')

function toSceneFilePaths(name: string) {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-')
  return {
    safeName,
    appJsonPath: join(APP_SCENES_DIR, `${safeName}.json`),
    appOnemoPath: join(APP_SCENES_DIR, `${safeName}.onemo`),
    studioJsonPath: join(STUDIO_SCENES_DIR, `${safeName}.json`),
    studioOnemoPath: join(STUDIO_SCENES_DIR, `${safeName}.onemo`),
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const { appJsonPath, appOnemoPath, studioJsonPath, studioOnemoPath } = toSceneFilePaths(name)

    const onemoPath = [studioOnemoPath, appOnemoPath].find((filePath) => existsSync(filePath))
    if (onemoPath) {
      const content = await readFile(onemoPath)
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      })
    }

    const jsonPath = [studioJsonPath, appJsonPath].find((filePath) => existsSync(filePath))
    if (jsonPath) {
      const content = await readFile(jsonPath, 'utf-8')
      return NextResponse.json(JSON.parse(content))
    }

    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const { safeName, appJsonPath, appOnemoPath, studioJsonPath, studioOnemoPath } = toSceneFilePaths(name)
    if (safeName === 'default') {
      return NextResponse.json({ error: 'Default scene is protected' }, { status: 403 })
    }

    let deleted = false
    for (const filePath of [studioOnemoPath, studioJsonPath, appOnemoPath, appJsonPath]) {
      if (!existsSync(filePath)) continue
      await unlink(filePath)
      deleted = true
    }

    if (!deleted) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    return NextResponse.json({ deleted: safeName })
  } catch {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }
}
