// Bench test-image libraries: ?dir=raw lists _WIP/v3.5/asset-lib (raw images, go through the
// AI cut); ?dir=cut lists _WIP/v3.5/cutouts (finished outlines, traced directly). Dev tooling.
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { LIB_DIRS } from './dirs'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const dir = LIB_DIRS[new URL(req.url).searchParams.get('dir') ?? 'raw']
  if (!dir) return Response.json([])
  try {
    const files = (await readdir(path.join(process.cwd(), dir))).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()
    return Response.json(files)
  } catch {
    return Response.json([])
  }
}
