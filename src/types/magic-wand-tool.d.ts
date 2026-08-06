declare module 'magic-wand-tool' {
  interface MWImage { data: Uint8ClampedArray | Uint8Array; width: number; height: number; bytes: number }
  interface MWMask { data: Uint8Array; width: number; height: number; bounds: { minX: number; minY: number; maxX: number; maxY: number } }
  const MagicWand: {
    floodFill(image: MWImage, px: number, py: number, colorThreshold: number, mask: Uint8Array | null, includeBorders: boolean): MWMask
    traceContours(mask: MWMask): unknown[]
    simplifyContours(contours: unknown[], simplifyTolerant: number, simplifyCount: number): unknown[]
  }
  export default MagicWand
}
