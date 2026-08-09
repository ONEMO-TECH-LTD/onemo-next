import type { MLResult, SegmentProgress } from './segment-ml'

/** runCutout(url) → seg — the AI cut. Owns the working-res cap (passes effectiveTextureDim() to
 *  segmentML — inv 19; the cut-out WORKER self-caps separately inside ben.worker.runRembg). Returns the
 *  segmentation DATA only: it does NOT publish, cache, seq-guard, or build a matte — the flow owns
 *  those concerns. */
export async function runCutout(url: string, onProgress?: (s: SegmentProgress) => void): Promise<MLResult> {
  const [{ segmentML }, { effectiveTextureDim }, { EFFECT_BUILD_CONFIG }] = await Promise.all([
    import('./segment-ml'),
    import('./mask'),
    import('./prepare-effect'),
  ])
  return segmentML(url, EFFECT_BUILD_CONFIG.maxImageDim, effectiveTextureDim(), onProgress)
}
