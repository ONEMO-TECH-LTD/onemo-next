// Production cut-out chain + matte feasibility. Kept pure so the worker policy is testable without
// importing worker globals.

export type RembgSpec = { adapter: string; url: string; size: number; mean: [number, number, number]; std: [number, number, number] }

const SEG_HOST = '/seg-models'

// Self-hosted, same-origin production weights. Silueta stays lazy because the worker reaches it only
// after u2netp fails.
export const REMBG = {
  u2netp: { adapter: 'u2netp', url: `${SEG_HOST}/u2netp.onnx`, size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
  silueta: { adapter: 'silueta', url: `${SEG_HOST}/silueta.onnx`, size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
} satisfies Record<string, RembgSpec>

export function resolveChain(): RembgSpec[] {
  return [REMBG.u2netp, REMBG.silueta]
}

// Matte feasibility: an empty (subject-not-found) or full-frame matte is not a usable cut — the chain
// treats it as a failure so it falls back to the next model (u2netp → silueta → flood-fill).
export const isDegenerateMatte = (subjFrac: number) => subjFrac < 0.005 || subjFrac > 0.995
