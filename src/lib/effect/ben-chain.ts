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

// PRODUCTION CUT-OUT CHAIN (Dan, 2026-06-16). Default (no `?seg=`) runs the free, mobile-fit trio:
//   u2netp (4 MB primary) → silueta (44 MB fallback) → [throw → prepare-effect flood-fill].
// Silueta is LAZY: the run loop only reaches silueta after u2netp throws, so the 44 MB never lands on
// the device unless the primary fails. `?seg=<model>` overrides with a single model (comparison
// harness); ben2 / birefnet / an unknown key → null → the transformers.js path.
export function resolveChain(seg?: string): RembgSpec[] | null {
  if (!seg) return [REMBG.u2netp, REMBG.silueta] // production default trio
  if (REMBG[seg]) return [REMBG[seg]]            // explicit single rembg model (test harness)
  return null                                    // ben2 / birefnet → transformers path
}

// Matte feasibility: an empty (subject-not-found) or full-frame matte is not a usable cut — the chain
// treats it as a failure so it falls back to the next model (u2netp → silueta → flood-fill).
export const isDegenerateMatte = (subjFrac: number) => subjFrac < 0.005 || subjFrac > 0.995
