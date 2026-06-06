'use client'

import type { BinaryMask } from './contour'
import type { ShapePoint, ShapedPreviewSettings } from './shape-spec'

interface LoadedImage {
  image: HTMLImageElement
  width: number
  height: number
}

export function loadImageElement(url: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      resolve({
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      })
    }
    image.onerror = () => reject(new Error('Failed to load artwork image.'))
    image.src = url
  })
}

function sampleBorderColor(data: Uint8ClampedArray, width: number, height: number) {
  const samples: number[][] = []
  const push = (x: number, y: number) => {
    const index = (y * width + x) * 4
    samples.push([data[index], data[index + 1], data[index + 2]])
  }

  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 24))) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 24))) {
    push(0, y)
    push(width - 1, y)
  }

  return samples.reduce(
    (acc, sample) => ({
      r: acc.r + sample[0] / samples.length,
      g: acc.g + sample[1] / samples.length,
      b: acc.b + sample[2] / samples.length,
    }),
    { r: 0, g: 0, b: 0 }
  )
}

function colorDistance(r: number, g: number, b: number, bg: { r: number; g: number; b: number }) {
  return Math.hypot(r - bg.r, g - bg.g, b - bg.b)
}

export function segmentImageToMask(loaded: LoadedImage, settings: ShapedPreviewSettings): BinaryMask {
  const scale = settings.maskResolution / Math.max(loaded.width, loaded.height)
  const width = Math.max(32, Math.round(loaded.width * scale))
  const height = Math.max(32, Math.round(loaded.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas is unavailable for browser segmentation.')
  }

  ctx.drawImage(loaded.image, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const mask = new Uint8Array(width * height)
  let transparentPixels = 0

  for (let i = 0; i < mask.length; i += 1) {
    if (data[i * 4 + 3] < 245) transparentPixels += 1
  }

  const hasAlphaSubject = transparentPixels > mask.length * 0.02
  if (hasAlphaSubject) {
    for (let i = 0; i < mask.length; i += 1) {
      mask[i] = data[i * 4 + 3] >= Math.max(12, settings.threshold) ? 1 : 0
    }
    return { width, height, data: mask, foregroundMode: 'alpha' }
  }

  const bg = sampleBorderColor(data, width, height)
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4
    const distance = colorDistance(data[offset], data[offset + 1], data[offset + 2], bg)
    mask[i] = distance >= settings.threshold ? 1 : 0
  }

  return { width, height, data: mask, foregroundMode: 'border-background' }
}

function pointAtLength(points: ShapePoint[], target: number) {
  let travelled = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    if (travelled + length >= target) {
      const t = length ? (target - travelled) / length : 0
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        tangent: { x: b.x - a.x, y: b.y - a.y },
      }
    }
    travelled += length
  }
  return { point: points[0], tangent: { x: 1, y: 0 } }
}

export function createEdgeBleedCanvas(loaded: LoadedImage, outerPx: ShapePoint[]) {
  const source = document.createElement('canvas')
  source.width = loaded.width
  source.height = loaded.height
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) throw new Error('Canvas is unavailable for edge bleed.')
  sourceCtx.drawImage(loaded.image, 0, 0, loaded.width, loaded.height)
  const sourceData = sourceCtx.getImageData(0, 0, loaded.width, loaded.height)

  const bounds = outerPx.reduce(
    (acc, point) => ({
      minX: Math.min(acc.minX, point.x),
      maxX: Math.max(acc.maxX, point.x),
      minY: Math.min(acc.minY, point.y),
      maxY: Math.max(acc.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  )
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }
  const perimeter = outerPx.reduce((sum, point, index) => {
    const next = outerPx[(index + 1) % outerPx.length]
    return sum + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)

  const bleed = document.createElement('canvas')
  bleed.width = 512
  bleed.height = 16
  const bleedCtx = bleed.getContext('2d')
  if (!bleedCtx) throw new Error('Canvas is unavailable for edge bleed.')
  const output = bleedCtx.createImageData(bleed.width, bleed.height)

  for (let x = 0; x < bleed.width; x += 1) {
    const { point } = pointAtLength(outerPx, (x / bleed.width) * perimeter)
    const towardCenter = { x: center.x - point.x, y: center.y - point.y }
    const len = Math.hypot(towardCenter.x, towardCenter.y) || 1
    const sx = Math.max(0, Math.min(loaded.width - 1, Math.round(point.x + (towardCenter.x / len) * 3)))
    const sy = Math.max(0, Math.min(loaded.height - 1, Math.round(point.y + (towardCenter.y / len) * 3)))
    const sourceIndex = (sy * loaded.width + sx) * 4
    for (let y = 0; y < bleed.height; y += 1) {
      const outIndex = (y * bleed.width + x) * 4
      output.data[outIndex] = sourceData.data[sourceIndex]
      output.data[outIndex + 1] = sourceData.data[sourceIndex + 1]
      output.data[outIndex + 2] = sourceData.data[sourceIndex + 2]
      output.data[outIndex + 3] = 255
    }
  }

  bleedCtx.putImageData(output, 0, 0)
  return bleed
}
