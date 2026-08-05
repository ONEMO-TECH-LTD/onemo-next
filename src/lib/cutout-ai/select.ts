// cutout-ai — candidate-mask pick. PURE. SAM returns N candidate masks per prompt; pick one.

/**
 * @param areas   foreground pixel count per candidate
 * @param scores  model IoU confidence per candidate
 * @param plane   total pixels (for area fraction)
 * @param auto    true = whole-object auto-detect → LARGEST valid mask (stable across fp16/q8,
 *                no face-vs-figure flip). false = user-guided → trust the best score.
 */
export function pickMask(areas: number[], scores: number[], plane: number, auto: boolean): number {
  const n = areas.length
  if (!auto) { let b = 0; for (let i = 1; i < n; i++) if (scores[i] > scores[b]) b = i; return b }
  let best = -1, bestArea = -1
  for (let i = 0; i < n; i++) { const f = areas[i] / plane; if (f > 0.05 && f < 0.92 && areas[i] > bestArea) { bestArea = areas[i]; best = i } }
  if (best < 0) { best = 0; for (let i = 1; i < n; i++) if (scores[i] > scores[best]) best = i }
  return best
}
