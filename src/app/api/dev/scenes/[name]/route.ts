import { NextResponse } from 'next/server'
import { readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

const SCENES_DIR = join(process.cwd(), 'data', 'scenes')

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params
    const filePath = join(SCENES_DIR, `${name}.json`)
    const content = await readFile(filePath, 'utf-8')
    return NextResponse.json(JSON.parse(content))
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
    const filePath = join(SCENES_DIR, `${name}.json`)
    await unlink(filePath)
    return NextResponse.json({ deleted: name })
  } catch {
    return NextResponse.json({ error: 'Scene not found' }, { status: 404 })
  }
}
