// The seven saved cut-out traces, so the surface can be driven without an upload.
// Read-only passthrough of the same evidence file the sealed corpus run used.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'vendor', 'magfit', 'canonical-traces.json')
    const text = await readFile(file, 'utf8')
    return new NextResponse(text, { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    )
  }
}
