// The ONLY door to the GPT-Pro reference core. Dev-local: it runs the compiled C++ binary and
// returns its stdout verbatim. Nothing here decides geometry — no scaling rule, no layout choice,
// no fallback answer. If the binary is missing the route says so instead of computing something.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const BINARY = path.join(process.cwd(), 'vendor', 'magfit', 'bin', 'magfit_cli')

function runBinary(payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(BINARY, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += chunk))
    child.stderr.on('data', (chunk) => (err += chunk))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err || `magfit_cli exited ${code}`))
    })
    child.stdin.write(payload)
    child.stdin.end()
  })
}

export async function POST(request: Request) {
  if (!existsSync(BINARY)) {
    return NextResponse.json(
      { ok: false, error: 'magfit_cli is not built — run vendor/magfit/build.sh' },
      { status: 503 },
    )
  }
  try {
    const body = await request.text()
    const raw = await runBinary(body)
    return new NextResponse(raw, { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
