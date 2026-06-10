'use client'

// Attachment bridge (Phase 3) — the SavePanel validates the chosen attachment system on the
// FINAL-physical-mm geometry (lib/effect/attachment, pure mm math) and writes the result here;
// ShapedModel renders the 3D visualization (anchor dots on the back cap; red locators on failure).
// The math lives in ONE place — this store only carries the verdict to the scene.

import { create } from 'zustand'
import type { AttachmentResult } from '@/lib/effect/attachment'
import type { EffectSize } from '@/lib/effect/sizes'

interface AttachmentStore {
  /** The validated attachment layout for the CURRENT shape+size selection (null = none chosen). */
  result: AttachmentResult | null
  setResult: (r: AttachmentResult | null) => void
  size: EffectSize
  setSize: (s: EffectSize) => void
}

export const useAttachmentStore = create<AttachmentStore>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  size: 's70',
  setSize: (size) => set({ size }),
}))
