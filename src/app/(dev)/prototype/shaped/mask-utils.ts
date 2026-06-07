import type { BinaryMask, MaskEditTool } from './shape-spec'

export function cloneMask(mask: BinaryMask): BinaryMask {
  return {
    width: mask.width,
    height: mask.height,
    data: new Uint8ClampedArray(mask.data),
  }
}

export function applyBrushEdit(
  mask: BinaryMask,
  x: number,
  y: number,
  radius: number,
  tool: MaskEditTool
): BinaryMask {
  const next = cloneMask(mask)
  const value = tool === 'restore' ? 255 : 0
  const radiusSq = radius * radius
  const minX = Math.max(0, Math.floor(x - radius))
  const maxX = Math.min(mask.width - 1, Math.ceil(x + radius))
  const minY = Math.max(0, Math.floor(y - radius))
  const maxY = Math.min(mask.height - 1, Math.ceil(y + radius))

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px - x
      const dy = py - y
      if (dx * dx + dy * dy <= radiusSq) {
        next.data[py * mask.width + px] = value
      }
    }
  }

  return next
}

export function maskCoverage(mask: BinaryMask) {
  let filled = 0
  for (let i = 0; i < mask.data.length; i += 1) {
    if (mask.data[i] > 127) filled += 1
  }

  return filled / mask.data.length
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    image.src = src
  })
}

export function imageToMaskFromAlphaOrLuma(
  image: HTMLImageElement,
  maxDimension = 900
): BinaryMask {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable')
  }

  ctx.drawImage(image, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  const data = new Uint8ClampedArray(width * height)
  let alphaHasSignal = false

  for (let i = 0; i < data.length; i += 1) {
    const alpha = pixels[i * 4 + 3]
    if (alpha < 250) alphaHasSignal = true
    data[i] = alpha > 127 ? 255 : 0
  }

  if (alphaHasSignal) {
    return { width, height, data }
  }

  // Fallback proposal only: estimate background from the border and keep pixels that differ.
  // The user-approved/editable mask remains the source of truth.
  for (let y = 0; y < height; y += 1) {
    const leftIndex = (y * width + 2) * 4
    const rightIndex = (y * width + width - 3) * 4
    const bgR = (pixels[leftIndex] + pixels[rightIndex]) * 0.5
    const bgG = (pixels[leftIndex + 1] + pixels[rightIndex + 1]) * 0.5
    const bgB = (pixels[leftIndex + 2] + pixels[rightIndex + 2]) * 0.5

    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const dr = pixels[offset] - bgR
      const dg = pixels[offset + 1] - bgG
      const db = pixels[offset + 2] - bgB
      const distance = Math.sqrt(dr * dr + dg * dg + db * db)
      data[y * width + x] = distance > 42 ? 255 : 0
    }
  }

  clearBorderTouchingRegions({ width, height, data })
  keepLargestComponent({ width, height, data })

  return { width, height, data }
}

function clearBorderTouchingRegions(mask: BinaryMask) {
  const visited = new Uint8Array(mask.width * mask.height)
  const queue: number[] = []

  const enqueue = (x: number, y: number) => {
    const index = y * mask.width + x
    if (visited[index] || mask.data[index] <= 127) return
    visited[index] = 1
    queue.push(index)
  }

  for (let x = 0; x < mask.width; x += 1) {
    enqueue(x, 0)
    enqueue(x, mask.height - 1)
  }
  for (let y = 0; y < mask.height; y += 1) {
    enqueue(0, y)
    enqueue(mask.width - 1, y)
  }

  while (queue.length > 0) {
    const index = queue.pop()
    if (index === undefined) break
    mask.data[index] = 0
    const x = index % mask.width
    const y = Math.floor(index / mask.width)
    if (x > 0) enqueue(x - 1, y)
    if (x < mask.width - 1) enqueue(x + 1, y)
    if (y > 0) enqueue(x, y - 1)
    if (y < mask.height - 1) enqueue(x, y + 1)
  }
}

function keepLargestComponent(mask: BinaryMask) {
  const visited = new Uint8Array(mask.width * mask.height)
  let best: number[] = []

  for (let start = 0; start < mask.data.length; start += 1) {
    if (visited[start] || mask.data[start] <= 127) continue
    const component: number[] = []
    const queue = [start]
    visited[start] = 1

    while (queue.length > 0) {
      const index = queue.pop()
      if (index === undefined) break
      component.push(index)
      const x = index % mask.width
      const y = Math.floor(index / mask.width)
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < mask.width - 1 ? index + 1 : -1,
        y > 0 ? index - mask.width : -1,
        y < mask.height - 1 ? index + mask.width : -1,
      ]

      neighbours.forEach((next) => {
        if (next >= 0 && !visited[next] && mask.data[next] > 127) {
          visited[next] = 1
          queue.push(next)
        }
      })
    }

    if (component.length > best.length) {
      best = component
    }
  }

  mask.data.fill(0)
  best.forEach((index) => {
    mask.data[index] = 255
  })
}
