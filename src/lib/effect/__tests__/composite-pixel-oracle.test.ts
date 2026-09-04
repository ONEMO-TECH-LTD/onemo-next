import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { transformWithEsbuild } from 'vite'
import { describe, expect, it } from 'vitest'

type Rgba = [number, number, number, number]

interface PixelWitness {
  coordinate: [number, number]
  pixel: Rgba
}

interface OracleResult {
  orientation: {
    top: PixelWitness
    bottom: PixelWitness
  }
  registration: {
    expectedMarker: PixelWitness
  }
  fill: {
    perimeter: PixelWitness[]
  }
  modes: {
    clampTopLeft: PixelWitness
    tileTopLeft: PixelWitness
  }
  settlement: {
    rejection: string
    cancellation: string
    timeout: string
    blobUrlsCreated: number
    blobUrlsRevoked: number
  }
}

function expectPixel(
  witness: string,
  fixture: string,
  actual: PixelWitness,
  expected: Rgba,
): void {
  expect(
    actual.pixel,
    `${witness} | fixture=${fixture} | pixel=(${actual.coordinate.join(',')}) | expected=${JSON.stringify(expected)} | actual=${JSON.stringify(actual.pixel)}`,
  ).toEqual(expected)
}

describe('composeEffectArtwork real-pixel oracle', () => {
  it('proves orientation, subject registration, exposed fill, and Clamp distinct from Tile', async () => {
    const sourcePath = join(process.cwd(), 'src/lib/effect/composite.ts')
    const transformed = await transformWithEsbuild(readFileSync(sourcePath, 'utf8'), sourcePath, {
      loader: 'ts',
      format: 'esm',
      target: 'es2022',
    })
    const browser = await chromium.launch({ channel: 'chrome', headless: true })

    try {
      const page = await browser.newPage()
      const result = await page.evaluate<OracleResult, string>(async (moduleCode) => {
        const moduleUrl = URL.createObjectURL(new Blob([moduleCode], { type: 'text/javascript' }))
        try {
          const importModule = new Function('url', 'return import(url)') as (
            url: string,
          ) => Promise<{ composeEffectArtwork: (input: object) => Promise<{ canvas: HTMLCanvasElement }> }>
          const { composeEffectArtwork } = await importModule(moduleUrl)
          const makeCanvas = (width: number, height: number, pixels: number[]): HTMLCanvasElement => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            canvas.getContext('2d')!.putImageData(
              new ImageData(new Uint8ClampedArray(pixels), width, height),
              0,
              0,
            )
            return canvas
          }
          const pixelAt = (canvas: HTMLCanvasElement, x: number, y: number): PixelWitness => ({
            coordinate: [x, y],
            pixel: Array.from(canvas.getContext('2d')!.getImageData(x, y, 1, 1).data) as Rgba,
          })
          const transparentPixels = (width: number, height: number): number[] => (
            Array(width * height * 4).fill(0)
          )

          const orientationOriginal = makeCanvas(2, 3, [
            32, 32, 32, 255, 32, 32, 32, 255,
            32, 32, 32, 255, 32, 32, 32, 255,
            32, 32, 32, 255, 32, 32, 32, 255,
          ])
          const orientationSubject = makeCanvas(2, 3, [
            255, 0, 0, 255, 255, 0, 0, 255,
            0, 255, 0, 255, 0, 255, 0, 255,
            0, 0, 255, 255, 0, 0, 255, 255,
          ])
          const orientation = await composeEffectArtwork({
            originalCanvas: orientationOriginal,
            subjectCanvas: orientationSubject,
            blendPercent: 0,
            fillMode: 'clamp',
          })

          const sourcePixels = [
            255, 0, 0, 255, 0, 255, 0, 255,
            0, 0, 255, 255, 255, 255, 0, 255,
          ]
          const registrationSubject = makeCanvas(2, 2, [
            0, 0, 0, 0, 255, 0, 255, 255,
            0, 0, 0, 0, 0, 0, 0, 0,
          ])
          const expandedBounds = { minX: -1, minY: -1, maxX: 3, maxY: 3 }
          const registration = await composeEffectArtwork({
            originalCanvas: makeCanvas(2, 2, sourcePixels),
            subjectCanvas: registrationSubject,
            outputBoundsPx: expandedBounds,
            blendPercent: 0,
            fillMode: 'clamp',
          })

          const transparentSubject = makeCanvas(2, 2, transparentPixels(2, 2))
          const clamp = await composeEffectArtwork({
            originalCanvas: makeCanvas(2, 2, sourcePixels),
            subjectCanvas: transparentSubject,
            outputBoundsPx: expandedBounds,
            blendPercent: 0,
            fillMode: 'clamp',
          })
          const tile = await composeEffectArtwork({
            originalCanvas: makeCanvas(2, 2, sourcePixels),
            subjectCanvas: transparentSubject,
            outputBoundsPx: expandedBounds,
            blendPercent: 0,
            fillMode: 'tile',
          })
          const perimeterCoordinates: Array<[number, number]> = [
            [0, 0], [1, 0], [2, 0], [3, 0],
            [0, 1], [3, 1], [0, 2], [3, 2],
            [0, 3], [1, 3], [2, 3], [3, 3],
          ]

          const NativeImage = window.Image
          const nativeSetTimeout = window.setTimeout.bind(window)
          const nativeCreateObjectURL = URL.createObjectURL.bind(URL)
          const nativeRevokeObjectURL = URL.revokeObjectURL.bind(URL)
          let blobUrlsCreated = 0
          let blobUrlsRevoked = 0
          URL.createObjectURL = (blob) => { blobUrlsCreated += 1; return nativeCreateObjectURL(blob) }
          URL.revokeObjectURL = (url) => { blobUrlsRevoked += 1; nativeRevokeObjectURL(url) }
          const filteredInput = () => ({
            originalCanvas: makeCanvas(2, 2, sourcePixels),
            subjectCanvas: transparentSubject,
            blendPercent: 50,
            fillMode: 'clamp',
          })
          const rejectionOf = async (promise: Promise<unknown>): Promise<string> => {
            try { await promise; return 'resolved unexpectedly' }
            catch (error) { return String((error as Error).message) }
          }
          let rejection = ''
          let cancellation = ''
          let timeout = ''
          try {
            class RejectingImage {
              onload: (() => void) | null = null
              onerror: (() => void) | null = null
              set src(value: string) { if (value) queueMicrotask(() => this.onerror?.()) }
            }
            Object.defineProperty(window, 'Image', { configurable: true, value: RejectingImage })
            rejection = await rejectionOf(composeEffectArtwork(filteredInput()))

            class HangingImage {
              onload: (() => void) | null = null
              onerror: (() => void) | null = null
              set src(_value: string) { /* deliberately never settles */ }
            }
            Object.defineProperty(window, 'Image', { configurable: true, value: HangingImage })
            let cancelled = false
            nativeSetTimeout(() => { cancelled = true }, 5)
            cancellation = await rejectionOf(composeEffectArtwork({ ...filteredInput(), cancelled: () => cancelled }))

            window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => (
              nativeSetTimeout(handler, delay === 30_000 ? 5 : delay, ...args)
            )) as typeof window.setTimeout
            timeout = await rejectionOf(composeEffectArtwork(filteredInput()))
          } finally {
            Object.defineProperty(window, 'Image', { configurable: true, value: NativeImage })
            window.setTimeout = nativeSetTimeout as typeof window.setTimeout
            URL.createObjectURL = nativeCreateObjectURL
            URL.revokeObjectURL = nativeRevokeObjectURL
          }

          return {
            orientation: {
              top: pixelAt(orientation.canvas, 0, 0),
              bottom: pixelAt(orientation.canvas, 0, 2),
            },
            registration: {
              expectedMarker: pixelAt(registration.canvas, 2, 1),
            },
            fill: {
              perimeter: perimeterCoordinates.map(([x, y]) => pixelAt(clamp.canvas, x, y)),
            },
            modes: {
              clampTopLeft: pixelAt(clamp.canvas, 0, 0),
              tileTopLeft: pixelAt(tile.canvas, 0, 0),
            },
            settlement: { rejection, cancellation, timeout, blobUrlsCreated, blobUrlsRevoked },
          }
        } finally {
          URL.revokeObjectURL(moduleUrl)
        }
      }, transformed.code)

      expectPixel('orientation', '2x3 asymmetric subject; clamp; blend=0', result.orientation.top, [255, 0, 0, 255])
      expectPixel('orientation', '2x3 asymmetric subject; clamp; blend=0', result.orientation.bottom, [0, 0, 255, 255])
      expectPixel('registration', '2x2 subject marker; bounds=(-1,-1)..(3,3); clamp; blend=0', result.registration.expectedMarker, [255, 0, 255, 255])

      for (const witness of result.fill.perimeter) {
        expect(
          witness.pixel[3],
          `fill | fixture=2x2 four-colour source; bounds=(-1,-1)..(3,3); clamp; blend=0 | pixel=(${witness.coordinate.join(',')}) | expected alpha=255 | actual=${JSON.stringify(witness.pixel)}`,
        ).toBe(255)
      }

      expectPixel('clamp-not-tile', '2x2 four-colour source; bounds=(-1,-1)..(3,3); blend=0', result.modes.clampTopLeft, [255, 0, 0, 255])
      expectPixel('clamp-not-tile', '2x2 four-colour source; bounds=(-1,-1)..(3,3); blend=0', result.modes.tileTopLeft, [255, 255, 0, 255])
      expect(result.settlement).toEqual({
        rejection: '[composite] SVG-filter image failed to load',
        cancellation: '[composite] SVG-filter image cancelled',
        timeout: '[composite] SVG-filter image timed out',
        blobUrlsCreated: 3,
        blobUrlsRevoked: 3,
      })
    } finally {
      await browser.close()
    }
  // No per-test cap: it inherits the 60 s default (vitest.config.mts, #217). This test drives a real
  // Chrome — launch plus four compose passes — and finishes in ~2 s on an idle machine, but the old
  // 30 s cap OVERRODE the raised default and reddened CI three times on work that never touched it
  // (2026-09-02/03/04, on untouched staging as well). The cap was the arbitrary number, not the work.
  })
})
