'use client'

import type { BinaryMask } from './contour'
import type { ShapedPreviewSettings } from './shape-spec'

interface LoadedImage {
  image: HTMLImageElement
  width: number
  height: number
}

type Rgb = [number, number, number]

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

function pushSample(samples: Rgb[], data: Uint8ClampedArray, width: number, x: number, y: number) {
  const index = (y * width + x) * 4
  samples.push([data[index], data[index + 1], data[index + 2]])
}

function sampleBorderColor(data: Uint8ClampedArray, width: number, height: number) {
  const samples: Rgb[] = []
  const push = (x: number, y: number) => {
    pushSample(samples, data, width, x, y)
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

function sampleCornerBackgroundPalette(data: Uint8ClampedArray, width: number, height: number) {
  const samples: Rgb[] = []
  const margin = Math.max(4, Math.round(Math.min(width, height) * 0.04))
  const patch = Math.max(12, Math.round(Math.min(width, height) * 0.1))
  const step = Math.max(1, Math.round(patch / 12))
  const rects = [
    { x0: margin, y0: margin, x1: margin + patch, y1: margin + patch },
    { x0: width - margin - patch, y0: margin, x1: width - margin, y1: margin + patch },
    { x0: margin, y0: height - margin - patch, x1: margin + patch, y1: height - margin },
    { x0: width - margin - patch, y0: height - margin - patch, x1: width - margin, y1: height - margin },
  ]

  rects.forEach((rect) => {
    for (let y = rect.y0; y < rect.y1; y += step) {
      for (let x = rect.x0; x < rect.x1; x += step) {
        pushSample(samples, data, width, x, y)
      }
    }
  })

  return samples
}

function paletteDistance(r: number, g: number, b: number, palette: Rgb[]) {
  let best = Infinity
  const stride = Math.max(1, Math.floor(palette.length / 180))
  for (let index = 0; index < palette.length; index += stride) {
    const sample = palette[index]
    const distance = Math.hypot(r - sample[0], g - sample[1], b - sample[2])
    if (distance < best) best = distance
  }
  return best
}

function fillInteriorBackground(mask: Uint8Array, width: number, height: number) {
  const exterior = new Uint8Array(mask.length)
  const queue: number[] = []

  function enqueue(x: number, y: number) {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const index = y * width + x
    if (mask[index] || exterior[index]) return
    exterior[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0)
    enqueue(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y)
    enqueue(width - 1, y)
  }

  while (queue.length) {
    const current = queue.pop()
    if (current === undefined) break
    const x = current % width
    const y = Math.floor(current / width)
    enqueue(x - 1, y)
    enqueue(x + 1, y)
    enqueue(x, y - 1)
    enqueue(x, y + 1)
  }

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] && !exterior[index]) {
      mask[index] = 1
    }
  }
}

function dilateMask(mask: Uint8Array, width: number, height: number, radius: number) {
  const output = new Uint8Array(mask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = false
      for (let dy = -radius; dy <= radius && !hit; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          if (mask[ny * width + nx]) {
            hit = true
            break
          }
        }
      }
      output[y * width + x] = hit ? 1 : 0
    }
  }
  return output
}

function erodeMask(mask: Uint8Array, width: number, height: number, radius: number) {
  const output = new Uint8Array(mask.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let keep = true
      for (let dy = -radius; dy <= radius && keep; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            keep = false
            break
          }
        }
      }
      output[y * width + x] = keep ? 1 : 0
    }
  }
  return output
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

  const edgeColor = sampleBorderColor(data, width, height)
  const backgroundPalette = sampleCornerBackgroundPalette(data, width, height)
  for (let i = 0; i < mask.length; i += 1) {
    const offset = i * 4
    const r = data[offset]
    const g = data[offset + 1]
    const b = data[offset + 2]
    const isDecorativeFrame = colorDistance(r, g, b, edgeColor) < Math.max(22, settings.threshold * 0.65)
    const distance = paletteDistance(r, g, b, backgroundPalette)
    mask[i] = !isDecorativeFrame && distance >= settings.threshold ? 1 : 0
  }
  const minFeaturePx = Math.max(1, Math.round((settings.minFeatureWidthMm / settings.targetMinDimensionMm) * Math.min(width, height)))
  const pruneRadius = Math.max(1, Math.round(minFeaturePx / 2))
  const closed = erodeMask(
    dilateMask(mask, width, height, pruneRadius),
    width,
    height,
    pruneRadius
  )
  mask.set(closed)
  fillInteriorBackground(mask, width, height)

  return { width, height, data: mask, foregroundMode: 'border-background' }
}
