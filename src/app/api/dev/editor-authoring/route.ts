import { NextResponse } from 'next/server'

import { createProjectAuthoringSession } from '../editor/authoring-session'
import type { AuthoringVariantCommand } from '../editor/authoring-compiler'

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const file = new URL(req.url).searchParams.get('file')
    const session = await createProjectAuthoringSession()
    return NextResponse.json(await session.loadCanvas(file))
  } catch (error) {
    const err = error as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'dev-only' }, { status: 403 })
  }
  try {
    const body = await req.json() as {
      command?: unknown
      expectedRevision?: unknown
      expectedSourceHashes?: Record<string, string>
    }
    if (!body.command || typeof body.expectedRevision !== 'number') {
      return NextResponse.json({ error: 'command and expectedRevision required' }, { status: 400 })
    }
    const session = await createProjectAuthoringSession()
    if (isUndoCommand(body.command)) {
      return NextResponse.json(await session.undoLastCommand({
        expectedRevision: body.expectedRevision,
        expectedSourceHashes: body.expectedSourceHashes,
      }))
    }
    if (!isAuthoringVariantCommand(body.command)) {
      return NextResponse.json({ error: 'invalid authoring command' }, { status: 400 })
    }
    return NextResponse.json(await session.executeCommand({
      command: body.command,
      expectedRevision: body.expectedRevision,
      expectedSourceHashes: body.expectedSourceHashes,
    }))
  } catch (error) {
    const err = error as Error & { status?: number }
    return NextResponse.json({ error: err.message, code: (err as { code?: string }).code }, { status: err.status ?? 500 })
  }
}

function isUndoCommand(value: unknown): value is { kind: 'undo' } {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === 'undo'
}

function isAuthoringVariantCommand(value: unknown): value is AuthoringVariantCommand {
  if (!value || typeof value !== 'object') return false
  const command = value as Partial<AuthoringVariantCommand>
  if (command.kind === 'create-variant') {
    return typeof command.file === 'string' && typeof command.name === 'string'
  }
  if (command.kind === 'rename-variant') {
    return typeof command.file === 'string' && typeof command.from === 'string' && typeof command.to === 'string'
  }
  if (command.kind === 'move-variant-frame') {
    return typeof command.file === 'string' &&
      typeof command.variantId === 'string' &&
      !!command.frame &&
      typeof command.frame.x === 'number' &&
      typeof command.frame.y === 'number' &&
      typeof command.frame.width === 'number' &&
      typeof command.frame.height === 'number'
  }
  return false
}
