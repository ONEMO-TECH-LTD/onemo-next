import { NextResponse } from 'next/server'

import { FileStudioDocumentStore } from '@/studio/persistence/scenePresetRepository'

const store = new FileStudioDocumentStore()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params
    const url = new URL(req.url)
    const publishedOnly = url.searchParams.get('published') === '1'

    const loaded = await store.getSceneConfig(name, { publishedOnly })
    if (!loaded) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    return NextResponse.json(loaded)
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  try {
    const { name } = await params
    const body = await req.json()

    if (!isRecord(body) || (body.action !== 'publish' && body.action !== 'archive')) {
      return NextResponse.json({ error: 'Invalid scene action' }, { status: 400 })
    }

    const document =
      body.action === 'publish'
        ? await store.publish(name)
        : await store.archive(name)

    if (!document) {
      return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
    }

    return NextResponse.json({
      action: body.action,
      document,
      scene: await store.getSceneConfig(name),
      summary: {
        id: document.metadata.id,
        slug: document.metadata.slug,
        name: document.metadata.name,
        modified: document.scene_preset.updated_at,
        status: document.scene_preset.status,
        version: document.scene_preset.version,
        publishedVersion: document.metadata.published_version,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
