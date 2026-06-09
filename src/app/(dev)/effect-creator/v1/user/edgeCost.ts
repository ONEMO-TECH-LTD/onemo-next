'use client'

// Editor-side image → edge-cost grid for the magnetic livewire (A3b). Loads the photo into a
// canvas, computes a Sobel gradient magnitude, and turns it into a per-cell traversal cost
// (low = strong edge). The pure Dijkstra pathfinder (outline-core/livewire) consumes this grid.
// Canvas work lives here (DOM); the pathfinder stays pure.

import type { CostGrid } from '@/lib/outline-core'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** One 8-neighbour dilation pass of a binary mask. */
function dilate(src: Uint8Array, W: number, H: number): Uint8Array {
  const out = new Uint8Array(src)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (src[y * W + x]) continue
      for (let dy = -1; dy <= 1 && !out[y * W + x]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && src[ny * W + nx]) { out[y * W + x] = 1; break }
        }
      }
    }
  }
  return out
}

/**
 * Build an edge-cost grid (Sobel) from an image URL, downscaled to `maxDim` on the longest side.
 * `priorNorm` (optional, A3c) = the BEN2 cut-out boundary in normalized [0,1] coords — cells near it
 * get low cost so the livewire prefers the AI boundary even where image edges are weak (hybrid).
 */
export async function buildEdgeCost(imageUrl: string, maxDim = 600, priorNorm?: Array<[number, number]>): Promise<CostGrid> {
  const img = await loadImage(imageUrl)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH, 1))
  const W = Math.max(2, Math.round(srcW * scale))
  const H = Math.max(2, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const data = ctx.getImageData(0, 0, W, H).data

  const gray = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]

  const grad = new Float32Array(W * H)
  let maxG = 1e-6
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -gray[(y - 1) * W + x - 1] - 2 * gray[y * W + x - 1] - gray[(y + 1) * W + x - 1] +
        gray[(y - 1) * W + x + 1] + 2 * gray[y * W + x + 1] + gray[(y + 1) * W + x + 1]
      const gy =
        -gray[(y - 1) * W + x - 1] - 2 * gray[(y - 1) * W + x] - gray[(y - 1) * W + x + 1] +
        gray[(y + 1) * W + x - 1] + 2 * gray[(y + 1) * W + x] + gray[(y + 1) * W + x + 1]
      const m = Math.hypot(gx, gy)
      grad[y * W + x] = m
      if (m > maxG) maxG = m
    }
  }

  // Low cost on strong edges, never zero (keeps Dijkstra well-behaved). Range ≈ [0.02, 1].
  const cost = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) cost[i] = 1 - 0.98 * (grad[i] / maxG)

  // A3c hybrid: fold the BEN2 boundary in as a prior — low cost in a band around it, so the livewire
  // clings to the AI boundary even where the image gradient is weak (hair, soft edges, busy bg).
  if (priorNorm && priorNorm.length > 1) {
    const seed = new Uint8Array(W * H)
    for (let i = 0; i < priorNorm.length; i++) {
      const a = priorNorm[i], b = priorNorm[(i + 1) % priorNorm.length]
      const ax = a[0] * W, ay = a[1] * H, bx = b[0] * W, by = b[1] * H
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)))
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const x = Math.round(ax + (bx - ax) * t), y = Math.round(ay + (by - ay) * t)
        if (x >= 0 && y >= 0 && x < W && y < H) seed[y * W + x] = 1
      }
    }
    let band: Uint8Array = seed
    const bandPx = Math.max(2, Math.round(Math.max(W, H) * 0.02))
    for (let it = 0; it < bandPx; it++) band = dilate(band, W, H)
    for (let i = 0; i < W * H; i++) if (band[i]) cost[i] = Math.min(cost[i], 0.08)
  }

  return { cost, width: W, height: H }
}
