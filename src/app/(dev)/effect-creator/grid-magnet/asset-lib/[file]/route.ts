// Serves one image from a bench test library (?dir=raw|cut). basename() confines reads.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { LIB_DIRS } from '../dirs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const dir = LIB_DIRS[new URL(req.url).searchParams.get('dir') ?? 'raw']
  if (!dir) return new Response('not found', { status: 404 })
  const { file } = await ctx.params
  const name = path.basename(decodeURIComponent(file))
  try {
    const buf = await readFile(path.join(process.cwd(), dir, name))
    const type = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg'
    return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'no-store' } })
  } catch {
    return new Response('not found', { status: 404 })
  }
}
