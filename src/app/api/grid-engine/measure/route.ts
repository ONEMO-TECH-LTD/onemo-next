// THE MEASUREMENT DOOR. One path, one JSON, two interchangeable backends proven byte-identical
// on the whole corpus (7/7): the WebAssembly build when it exists (what production serves — the
// normal build compiles it from source), otherwise the native binary (dev convenience). The door
// decides nothing about geometry; if neither backend exists it says so rather than computing
// something of its own.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const WASM_MODULE = path.join(process.cwd(), 'vendor', 'magfit', 'wasm', 'magfit.cjs')
const BINARY = path.join(process.cwd(), 'vendor', 'magfit', 'bin', 'measure_cli')

// The wasm engine, loaded once per server process. Requests travel through the HEAP — the wasm
// stack is 64KB and a traced outline is hundreds of KB.
interface MagfitModule {
  lengthBytesUTF8(text: string): number
  stringToUTF8(text: string, pointer: number, bytes: number): void
  UTF8ToString(pointer: number): string
  _malloc(bytes: number): number
  _free(pointer: number): void
  _magfit_measure_json(pointer: number): number
  _magfit_free(pointer: number): void
}
let wasmEngine: Promise<MagfitModule> | null = null

function measureViaWasm(payload: string): Promise<string> {
  if (!wasmEngine) {
    // Node's own module loader, reached through the runtime so the bundler cannot rewrite it:
    // the engine is a build output living outside the bundle, and its .cjs locates its .wasm
    // relative to its real directory.
    const nodeModule = process.getBuiltinModule('node:module') as typeof import('node:module')
    const nodeRequire = nodeModule.createRequire(path.join(process.cwd(), 'package.json'))
    const factory = nodeRequire(WASM_MODULE) as () => Promise<MagfitModule>
    wasmEngine = factory()
  }
  return wasmEngine.then((mod) => {
    const bytes = mod.lengthBytesUTF8(payload) + 1
    const inPtr = mod._malloc(bytes)
    mod.stringToUTF8(payload, inPtr, bytes)
    const outPtr = mod._magfit_measure_json(inPtr)
    const out = mod.UTF8ToString(outPtr)
    mod._magfit_free(outPtr)
    mod._free(inPtr)
    return out
  })
}

function measureViaBinary(payload: string): Promise<string> {
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
  const hasWasm = existsSync(WASM_MODULE)
  const hasBinary = existsSync(BINARY)
  if (!hasWasm && !hasBinary) {
    return NextResponse.json(
      {
        ok: false,
        sizes: [],
        error: 'engine not built — run vendor/magfit/build-wasm.sh or vendor/magfit/build.sh',
      },
      { status: 503 },
    )
  }
  try {
    const payload = await request.text()
    const body = hasWasm ? await measureViaWasm(payload) : await measureViaBinary(payload)
    return new NextResponse(body, { headers: { 'content-type': 'application/json' } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, sizes: [], error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
