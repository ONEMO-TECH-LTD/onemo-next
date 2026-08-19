// Bench test-image library: lists Dan's _WIP/v3.5/cutouts folder. Dev tooling, not product.
import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

const DIR = path.join(process.cwd(), '_WIP/v3.5/cutouts')

export async function GET() {
  try {
    const files = (await readdir(DIR)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()
    return Response.json(files)
  } catch {
    return Response.json([])
  }
}
