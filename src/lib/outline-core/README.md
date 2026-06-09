# outline-core — deterministic 2D outline foundation (A1a)

The headless foundation of the Manual Sticker Maker. A plain numeric **`OutlineDocument`** in
source-image px is the single source of truth; the SVG render, the flattened manufacturing
polygon, and the 3D mesh are all **derived**. This package is consumed **identically** by the
client worker, the server canonical compiler, and the golden tests — so the screen and the
factory cannot disagree.

Pure + deterministic: no DOM, no three.js, no randomness, no `Date.now()`.

> Build authority: `shaped-effects-FINAL-SPEC.md` → **ADDENDUM C** (§C1–C13, AMEND-C1..C9 + F1..F3).
> This is the A1a slice — **before any UI**.

## Resolve chain (one-way; resolve BEFORE flatten — AMEND-F2)

```
OutlineDocument
  → resolve (segment types + local smoothing + per-node corner radii)
  → flatten (profile tolerance)
  → normalize rings (closure / winding / self-intersection)
  → px→mm (engine transform_chain, downstream)
  → ShapeSpecCanonical.geometry_mm → Clipper / mesh / attachment / manufacturing
```

Edits mutate `OutlineDocument`; everything else is derived. Per-node corner radii disable the
engine's global `filletCorners` (no double-round — `ResolvedOutlinePolicy`).

## A1a deliverables (order)

1. **Schema** — `types.ts` ✅ (this slice). `OutlineDocument`, discriminated `OutlineRing`,
   `OutlineNode`, `CornerSpec`, `ShapeSpecDraftInput` (outline_based editing/approved),
   `ResolvedOutline`, `GeometryLocator`.
2. **Reducer** — `applyOutlineCommands(baseSnapshot, commands) → OutlineDocument`, plus the
   provenance invariant `hash(replay(baseSnapshot, edit_ops)) === outline_document_hash`
   (reject on mismatch — AMEND-F1).
3. **Resolver** — `resolveOutlineDocument / applyCornerRadii / flattenPath / normalizeRings /
   validateSelfIntersection / generateLocators` (AMEND-C9). Corner clamp uses **θ = INTERIOR
   angle** (`radiusMax = min(L1,L2)·tan(θ/2)·safety`) — reuses the engine's `filletCorners` math.
4. **Hashing** — `outlineDocumentHash()` over the **canonical persistent projection** (derived
   `winding`/`kind`/`maxRadiusPx` excluded, stable serialization) so client + server hash
   identically (NIT-F1).
5. **Server canonical path** — `outline_based` draft → server re-resolve → px→mm →
   `ShapeSpecCanonical` → canonicalization diff (fail-closed).
6. **Golden fixtures** — square · triangle · rounded-rect · concave star · 3-node ring ·
   4-node ring · hole ring · locked corner · per-corner radius · malformed command/doc mismatch.
   Client preview vs server re-resolve must match within the canonicalization-diff thresholds.

## What this is NOT

No UI, no editor shell, no livewire, no SDF blend (`resolveSdfBlend()` arrives at A2b). The
on-screen editor (A1b+) is built on the **copied `/sticker-maker` configurator** using the
ONEMO **design system** (Tailwind semantic tokens, Chillax/Satoshi, pill + brand-stroke) — the
original `/shaped` configurator is never modified.
