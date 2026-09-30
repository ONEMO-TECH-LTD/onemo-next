// SVG string → canvas. When the SVG embeds fonts, some browsers (Chrome) finish decoding the image
// before the embedded font is ready and draw the fallback font, so those are drawn again once settled.

export async function rasterize(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, w, h)
    if (svg.includes('@font-face')) {
      await new Promise((r) => setTimeout(r, 120))
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
    }
    return cv
  } finally {
    URL.revokeObjectURL(url)
  }
}
