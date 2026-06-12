#!/usr/bin/env python3
# pixel-qa fix list (QA-VERDICT-v21-full-pixel-qa.md) — run from the layera worktree AFTER
# fab-qa's window closes. All six items, asserted edits.
import re, sys, os
os.chdir('/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s57-v3-layera')

def edit(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        assert old in s, (path, old[:70])
        s = s.replace(old, new)
    open(path, 'w').write(s)
    print('edited', path)

# F1: EditOverlay loses the dead Position branch — it becomes the drag-drop indicator only
s = open('src/app/(dev)/effect-creator/v3/user/EditOverlay.tsx').read()
open('src/app/(dev)/effect-creator/v3/user/EditOverlay.tsx', 'w').write(
'''// Drag-and-drop upload indicator — the only overlay this component owns. (The old Position-mode
// banner died with hero Position: photo placement is a gesture inside the editor's Image mode.)

'use client'

export default function EditOverlay({ isDragging }: { isDragging: boolean }) {
  if (!isDragging) return null
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 600 }}>Drop the image to upload</div>
    </div>
  )
}
''')
print('rewrote EditOverlay')

edit('src/app/(dev)/effect-creator/v3/page.tsx', [
  ("""      {/* drag-and-drop indicator (upload affordance) */}
      <EditOverlay
        isEditing={false}
        scale={designState.scale}
        isDragging={isDragging}
      />""",
   """      {/* drag-and-drop indicator (upload affordance) */}
      <EditOverlay isDragging={isDragging} />"""),
  # F4: stale Save/library header lines
  ("""// pans/zooms the photo within the shape on matrix-only transforms; Trim recolors the live object;
// Save runs the feasibility gate and locks the design (recipe + payload, F1-bound), then the
// offscreen render factory photographs it for the library.""",
   """// pans/zooms the photo within the shape on matrix-only transforms; Trim recolors the live back
// material. There is NO save surface this wave (erased by ruling — the manufacturing contract
// modules stay pure + tested underneath for the future save round)."""),
])

# F3: payload doc-hash vocabulary out of the live contract comments
edit('src/lib/effect/payload.ts', [
  ("// is gone from the save path (no resolve, no legacy document-hash field).",
   "// is gone from the save path entirely."),
  ("// `build.vector_shape_hash` (canonical VShape identity) replaces the legacy document-hash field;",
   "// `build.vector_shape_hash` (canonical VShape identity) is the ONLY geometry identity field;"),
])

# F4: stale tool-architecture comments
edit('src/app/(dev)/effect-creator/v3/user/OutlineEditor.tsx', [
  ("""// Effect Creator V3 — 2D outline editor overlay (blueprint §5.3 / §6.3 / G11 / G12).
// Core toolset per §7a: anchors (drag/add/delete), Smooth, Scale, Shape presets, magic-blend
// toggle. Hug and the Round tool are NOT in core (parked/folded — D4/D5;
// engine-level default rounding stays internal). Continuous controls are TickBars (G12) riding the
// §6.3 tick/commit contract.""",
   """// Effect Creator V3 — 2D outline editor overlay (REBUILD-PLAN-v2 Layer A).
// One room for every shape source. Modes: Shape (sources) · Adjust (Radius · Curve · Tune ✦) ·
// Image (Bright/Contrast/Color/Warmth/Blend + photo-as-gesture). Frame is the default state;
// double-tap = Points; the node bar owns point work. Continuous controls are TickBars (G12)
// riding the §6.3 tick/commit contract."""),
  ("""  // Points toggle (Dan, 2026-06-10): anchors stay ON for free-form outlines but OFF for rigid
  // parametric shapes — a circle has ~60 vertices; one stray drag spoils it. Toggle in the topbar.""",
   """  // Points state (plan A3): anchors are summoned by double-tapping the shape — never a button."""),
])

edit('src/app/(dev)/effect-creator/v3/user/shapes.ts', [
])

# F5: image upload gets the mm-true pair floor, scaled from image space to the upload-mask space;
# the crop-corner default is intentionally OMITTED for uploads (a logo's frame corners are design
# intent, not photo-crop artifacts) — now explicit, not implicit.
edit('src/app/(dev)/effect-creator/v3/user/OutlineEditor.tsx', [
  ("""      const ring = traceContourRaw(smoothMask(mask, width, height, 3), width, height)
      if (!ring) throw new Error('No clear shape found — try an image with a stronger silhouette')
      let area = 0
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1] }
      const oriented = area > 0 ? [...ring].reverse() : ring
      const v = vectoriseTrace(oriented.map(([x, y]) => [x, height - y] as [number, number]), height, useOutlineStore.getState().fairing?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL))
      if (!v) throw new Error('No clear shape found — try an image with a stronger silhouette')
      return v""",
   """      const ring = traceContourRaw(smoothMask(mask, width, height, 3), width, height)
      if (!ring) throw new Error('No clear shape found — try an image with a stronger silhouette')
      let area = 0
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area += a[0] * b[1] - b[0] * a[1] }
      const oriented = area > 0 ? [...ring].reverse() : ring
      // the SAME mm-true pair floor as every other source, scaled from image space to this
      // upload-mask space (the fit result is box-fitted to the image afterwards). The CROP-CORNER
      // default is intentionally OMITTED here: a logo's frame-touching corners are design intent,
      // not photo-crop artifacts (pixel-qa F5 — the policy is explicit, not an implicit fork).
      const { widthPx, heightPx } = dimsRef.current
      const sp = useOutlineStore.getState().spec
      const floorImagePx = MIN_ANCHOR_SEPARATION_MM / (sp?.mmPerPx || 70 / Math.max(widthPx, heightPx))
      const minAnchorSepPx = floorImagePx * (Math.max(width, height) / Math.max(widthPx, heightPx))
      const v = vectoriseTrace(oriented.map(([x, y]) => [x, height - y] as [number, number]), height, useOutlineStore.getState().fairing?.params ?? fairingFromDetail(BEN_DEFAULT_DETAIL), { minAnchorSepPx })
      if (!v) throw new Error('No clear shape found — try an image with a stronger silhouette')
      return v"""),
  # F6: dead canTune
  ("""  // D3 one-toolset: Tune is UNIVERSAL — trace shapes re-fair their RAW trace (best source);
  // every other shape fairs from the current path's flatten, both through THE one pipeline.
  const canTune = !!vshape
""", """  // D3 one-toolset: Tune is UNIVERSAL — trace shapes re-fair their RAW trace (best source);
  // every other shape fairs from the current path's flatten, both through THE one pipeline.
"""),
])

# F6: ImageSheet's unused art prop (and the caller)
edit('src/app/(dev)/effect-creator/v3/user/editor/sheets.tsx', [
  ("""export function ImageSheet({ imageSub, setImageSub, art, fxDraft, setFxDraft, blendBlur, setBlendBlur, writeBlend }: {
  imageSub: ImageSub
  setImageSub: (k: ImageSub) => void
  art: { scale: number }
  fxDraft: ImageFx""",
   """export function ImageSheet({ imageSub, setImageSub, fxDraft, setFxDraft, blendBlur, setBlendBlur, writeBlend }: {
  imageSub: ImageSub
  setImageSub: (k: ImageSub) => void
  fxDraft: ImageFx"""),
])
edit('src/app/(dev)/effect-creator/v3/user/OutlineEditor.tsx', [
  ("""        <ImageSheet imageSub={imageSub} setImageSub={setImageSub} art={art} fxDraft={fxDraft} setFxDraft={setFxDraft}
          blendBlur={blendBlur} setBlendBlur={setBlendBlur} writeBlend={writeBlend} />""",
   """        <ImageSheet imageSub={imageSub} setImageSub={setImageSub} fxDraft={fxDraft} setFxDraft={setFxDraft}
          blendBlur={blendBlur} setBlendBlur={setBlendBlur} writeBlend={writeBlend} />"""),
])
print("ALL EDITS DONE — next: icons.tsx orphan trim (manual review), shapes.ts comment, tsc/lint/tests")
