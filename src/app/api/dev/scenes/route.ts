import { NextResponse } from 'next/server'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const APP_SCENES_DIR = join(process.cwd(), 'data', 'scenes')
const STUDIO_SCENES_DIR = join(process.cwd(), 'studio', 'data', 'scenes')

async function listSceneNames() {
  await mkdir(APP_SCENES_DIR, { recursive: true })
  await mkdir(STUDIO_SCENES_DIR, { recursive: true })

  const preferredScenes = new Map<string, 'onemo' | 'json'>()
  const [appFiles, studioFiles] = await Promise.all([
    readdir(APP_SCENES_DIR),
    readdir(STUDIO_SCENES_DIR),
  ])

  for (const file of studioFiles) {
    if (file.endsWith('.onemo')) {
      preferredScenes.set(file.slice(0, -6), 'onemo')
    } else if (file.endsWith('.json')) {
      preferredScenes.set(file.slice(0, -5), 'json')
    }
  }

  for (const file of appFiles) {
    if (file.endsWith('.onemo')) {
      preferredScenes.set(file.slice(0, -6), 'onemo')
    } else if (file.endsWith('.json')) {
      const sceneName = file.slice(0, -5)
      if (!preferredScenes.has(sceneName)) {
        preferredScenes.set(sceneName, 'json')
      }
    }
  }

  return Array.from(preferredScenes.keys()).sort((a, b) => a.localeCompare(b))
}

export async function GET() {
  try {
    const scenes = await listSceneNames()
    return NextResponse.json({ scenes })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await mkdir(APP_SCENES_DIR, { recursive: true })
    await mkdir(STUDIO_SCENES_DIR, { recursive: true })

    const name = req.headers.get('x-scene-name')?.trim()
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/octet-stream')) {
      if (!name) {
        return NextResponse.json({ error: 'Scene name required' }, { status: 400 })
      }

      const body = Buffer.from(await req.arrayBuffer())
      if (!body.length) {
        return NextResponse.json({ error: 'Binary scene body is required' }, { status: 400 })
      }

      const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '-')
      const filePath = join(STUDIO_SCENES_DIR, `${safeName}.onemo`)
      await writeFile(filePath, body)
      return NextResponse.json({ saved: safeName })
    }

    const config = await req.json()
    const configName = config.name
    if (!configName || typeof configName !== 'string') {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const safeName = configName.replace(/[^a-zA-Z0-9_-]/g, '-')
    const filePath = join(APP_SCENES_DIR, `${safeName}.json`)
    await writeFile(filePath, JSON.stringify(config, null, 2))
    return NextResponse.json({ saved: safeName })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
