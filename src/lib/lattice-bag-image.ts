import { traceContourRaw } from './effect/contour'
import { maskFromImageData } from './effect/image-shape'
import type { Pt } from './effect/types'
import { normalizeBagOutline } from './lattice-bag-compute'
import { BAG_SOLVER_SPEC } from './lattice-bag-spec'

async function decodedImage(source: string) {
  const image = new Image()
  image.src = source
  await image.decode()
  return image
}

export async function outlineFromPath(path: string) {
  return outlineFromImage(await decodedImage(path))
}

export async function outlineFromFile(file: File) {
  const url = URL.createObjectURL(file)
  try {
    return outlineFromImage(await decodedImage(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function outlineFromImage(image: HTMLImageElement): Pt[] {
  const longest = Math.max(image.naturalWidth, image.naturalHeight)
  const ratio = Math.min(1, BAG_SOLVER_SPEC.imageTraceMaxPixels / longest)
  const width = Math.max(1, Math.round(image.naturalWidth * ratio))
  const height = Math.max(1, Math.round(image.naturalHeight * ratio))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('This browser cannot read the uploaded shape')
  context.drawImage(image, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const traced = traceContourRaw(maskFromImageData(imageData).mask, width, height)
  if (!traced) throw new Error('No closed shape was found in that image')
  const stride = Math.max(1, Math.ceil(traced.length / BAG_SOLVER_SPEC.tracePointLimit))
  return normalizeBagOutline(traced.filter((_, index) => index % stride === 0))
}
