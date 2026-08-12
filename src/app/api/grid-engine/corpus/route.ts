// THE CORPUS DOOR — the seven saved cut-out traces, verbatim from the shared evidence file the
// three independent implementations were all fed. Read-only passthrough; nothing is reshaped.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const file = path.join(process.cwd(), 'vendor', 'magfit', 'canonical-traces.json')
    return new NextResponse(await readFile(file, 'utf8'), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 404 },
    )
  }
}
