// THE MEASUREMENT DOOR — phase A: it runs the native binary and returns its stdout verbatim.
// Phase B replaces what is behind this door with the WebAssembly build; the path and the JSON
// stay identical, so nothing above it changes.
//
// No geometry, no defaults, no fallback answer: if the engine is not built, this says so rather
// than computing something of its own.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const BINARY = path.join(process.cwd(), 'vendor', 'magfit', 'bin', 'measure_cli')

function run(payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(BINARY, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(err || `engine exited ${code}`)),
    )
    child.stdin.write(payload)
    child.stdin.end()
  })
}

export async function POST(request: Request) {
  if (!existsSync(BINARY)) {
    return NextResponse.json(
      { ok: false, sizes: [], error: 'engine not built — run vendor/magfit/build.sh' },
      { status: 503 },
    )
  }
  try {
    return new NextResponse(await run(await request.text()), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, sizes: [], error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
