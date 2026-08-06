// ben-chain — the cut-out CHAIN composition + matte feasibility, extracted from ben.worker.ts as a
// PURE, unit-testable module (KAI-9087). The worker imports these; a test can import them WITHOUT the
// worker globals (onmessage / self / postMessage), which a direct worker import would crash on.
//
// `adapter` = the STABLE model identity reported back on a successful cut (R1 — the spec/telemetry
// records the model that actually ran, a true id, never the hard-coded `ben2-onnx` constant).

export type RembgSpec = { adapter: string; url: string; size: number; mean: [number, number, number]; std: [number, number, number] }

const SEG_HOST = '/seg-models'                                                 // self-hosted (production)
const REMBG_HOST = 'https://huggingface.co/tomjackson2023/rembg/resolve/main'  // CDN (test harness only)

// PRODUCTION trio weights are SELF-HOSTED same-origin under public/seg-models (no third-party fetch,
// offline-capable). The test-only comparison models (u2net/isnet) stay on the HF CDN.
export const REMBG: Record<string, RembgSpec> = {
  // U^2-Net family — input 320, ImageNet mean/std
  silueta: { adapter: 'silueta', url: `${SEG_HOST}/silueta.onnx`,   size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // self-hosted (fallback)
  u2netp:  { adapter: 'u2netp',  url: `${SEG_HOST}/u2netp.onnx`,    size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // self-hosted (primary)
  u2net:   { adapter: 'u2net',   url: `${REMBG_HOST}/u2net.onnx`,   size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] }, // harness only
  // IS-Net (DIS general-use) — input 1024, 0.5/1.0 normalize
  isnet:   { adapter: 'isnet-general-use', url: `${REMBG_HOST}/isnet-general-use.onnx`, size: 1024, mean: [0.5, 0.5, 0.5], std: [1.0, 1.0, 1.0] }, // harness only
}

// ── SAM roster entries (s62, Dan: "add the model to the roster of v5.3.1 and swap them") ─────────
// Promptable segmentation slotted into the SAME worker chain as the rembg family. The worker runs
// encoder+decoder with the model's documented preprocess and a central auto-prompt, then the raw
// low-res mask map enters the IDENTICAL post-generation tail as u2net's saliency (min-max → alpha →
// upscale → RGBA matte → degenerate guard). Selected via `?seg=edgesam`; the production trio rides
// behind it as the fallback chain, so a SAM failure degrades exactly like a u2netp failure.
export type SamSpec = {
  kind: 'sam'; adapter: string; enc: string; dec: string; size: number
  mean: [number, number, number]; std: [number, number, number]
}
export type ChainSpec = RembgSpec | SamSpec
export const isSamSpec = (s: ChainSpec): s is SamSpec => (s as SamSpec).kind === 'sam'
export const SAM: Record<string, SamSpec> = {
  edgesam: {
    kind: 'sam', adapter: 'edgesam',
    enc: `${SEG_HOST}/edgesam.encoder.onnx`, dec: `${SEG_HOST}/edgesam.decoder.onnx`,
    size: 1024, mean: [123.675, 116.28, 103.53], std: [58.395, 57.12, 57.375], // SAM-family ImageNet (raw-pixel scale)
  },
}
/** SAM auto-candidate eligibility (s62 device-verified): a mask is a plausible SUBJECT only when
 *  it covers a sane fraction of the image. THE one rule — the worker roster runner AND the brush
 *  add-on's picker both import it (no duplicated thresholds anywhere). */
export const SAM_AREA = { min: 0.05, max: 0.92 } as const
export const samAreaEligible = (frac: number): boolean => frac > SAM_AREA.min && frac < SAM_AREA.max

/** Central auto-prompt (normalized coords) when no user hint exists — recognise the main object. */
export const SAM_CENTRAL_PROMPT: ReadonlyArray<readonly [number, number]> = [
  [0.5, 0.5], [0.4, 0.4], [0.6, 0.4], [0.4, 0.6], [0.6, 0.6], [0.5, 0.3], [0.5, 0.7],
]

// PRODUCTION CUT-OUT CHAIN (Dan, 2026-06-16). Default (no `?seg=`) runs the free, mobile-fit trio:
//   u2netp (4 MB primary) → silueta (44 MB fallback) → [throw → prepare-effect flood-fill].
// Silueta is LAZY: the run loop only reaches silueta after u2netp throws, so the 44 MB never lands on
// the device unless the primary fails. `?seg=<model>` overrides with a single model (comparison
// harness) — or a SAM roster entry + the trio as fallback; ben2 / birefnet / an unknown key → null →
// the transformers.js path.
export function resolveChain(seg?: string): ChainSpec[] | null {
  if (!seg) return [REMBG.u2netp, REMBG.silueta] // production default trio
  if (SAM[seg]) return [SAM[seg], REMBG.u2netp, REMBG.silueta] // SAM primary, trio fallback
  if (REMBG[seg]) return [REMBG[seg]]            // explicit single rembg model (test harness)
  return null                                    // ben2 / birefnet → transformers path
}

// Matte feasibility: an empty (subject-not-found) or full-frame matte is not a usable cut — the chain
// treats it as a failure so it falls back to the next model (u2netp → silueta → flood-fill).
export const isDegenerateMatte = (subjFrac: number) => subjFrac < 0.005 || subjFrac > 0.995
