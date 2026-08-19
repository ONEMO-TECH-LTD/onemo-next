// Serves one image from the bench test library. basename() confines reads to the folder.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const DIR = path.join(process.cwd(), '_WIP/v3.5/cutouts')

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params
  const name = path.basename(decodeURIComponent(file))
  try {
    const buf = await readFile(path.join(DIR, name))
    const type = /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg'
    return new Response(new Uint8Array(buf), { headers: { 'content-type': type, 'cache-control': 'no-store' } })
  } catch {
    return new Response('not found', { status: 404 })
  }
}
