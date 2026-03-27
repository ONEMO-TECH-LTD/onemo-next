import { NextResponse } from 'next/server'

import type { SceneConfig } from '@/app/(dev)/prototype/types'
import {
  buildStudioOnlyState,
  type StudioOnlyState,
} from '@/studio/persistence/studioDocument'
import { FileStudioDocumentStore } from '@/studio/persistence/scenePresetRepository'

const store = new FileStudioDocumentStore()

interface SaveSceneRequestBody {
  scene?: SceneConfig
  studioState?: StudioOnlyState
  name?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function looksLikeSceneConfig(value: unknown): value is SceneConfig {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.modelPath === 'string' &&
    isRecord(value.face) &&
    isRecord(value.back) &&
    isRecord(value.frame) &&
    isRecord(value.scene) &&
    isRecord(value.colors)
  )
}

function getSavePayload(
  body: unknown,
): { scene: SceneConfig; studioState: StudioOnlyState } | null {
  if (looksLikeSceneConfig(body)) {
    return {
      scene: body,
      studioState: buildStudioOnlyState({ config: body }),
    }
  }

  if (isRecord(body) && looksLikeSceneConfig(body.scene)) {
    const request = body as SaveSceneRequestBody
    const scene = request.scene as SceneConfig
    return {
      scene,
      studioState: request.studioState ?? buildStudioOnlyState({ config: scene }),
    }
  }

  return null
}

export async function GET() {
  try {
    const entries = await store.listSummaries()
    return NextResponse.json({
      scenes: entries.map((entry) => entry.slug),
      entries: entries.map((entry) => ({
        id: entry.id,
        slug: entry.slug,
        name: entry.name,
        modified: entry.updated_at,
        status: entry.status,
        version: entry.version,
        publishedVersion: entry.published_version,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const payload = getSavePayload(body)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid studio scene payload' }, { status: 400 })
    }

    const document = await store.saveDraft({
      name: payload.scene.name,
      sceneConfig: payload.scene,
      studioState: payload.studioState,
    })

    return NextResponse.json({
      saved: document.metadata.slug,
      document,
      scene: payload.scene,
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
