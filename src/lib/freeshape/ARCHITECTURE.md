# freeshape — draw-normalizer contract (s62, designed with Dan 2026-08-05)

The fixed reference for the freehand shape tool. Any code in this folder violating a line here is
slop by definition and gets deleted, not defended.

## Mission
The user draws a shape with a finger — wobbly, imperfect — and gets back an ELEGANT normalized
vector outline. Apple-Notes shape recognition for the effect constructor: manual mode with
auto-tune. ZERO AI — pure geometry. Covers Dan's green-blob case: a drawn loop IS the shape,
never an object-recognition prompt.

## Laws
1. **No AI, no downloads.** This folder never imports cutout-ai, transformers, or onnxruntime.
   A drawn loop never reaches a segmentation model.
2. **v5.3.1 kernels do the geometry.** Curve fitting = the engine's Schneider fitter
   (`vector-core` ringToVPath); smoothing/simplify/rounding = the engine's Paper/Clipper kernels;
   fold-guard = the engine's self-intersection validator. This folder REINVENTS NONE of them —
   it only decides intent and orchestrates the calls.
3. **Output is a first-class v5.3.1 source.** The result is a sharp-capable `VShape` that seeds an
   `OutlineSource` exactly like an AI trace does — so the WHOLE existing stack (AUTO_TUNE default,
   the seven knobs, value-reflection, byte-identical reverse) applies to drawn shapes with zero
   special-casing. A drawn shape is not a second kind of shape.
4. **One sub = one job = one file.** No UI in this folder; the shell renders the ink and calls one
   entry point. No pixel loops anywhere here — this is vector-only.
5. **Borrowed feel, owned judgment.** Stroke capture/feel = perfect-freehand (MIT). Primitive
   classification may use $1-family recognizers (MIT-class). The HARMONIZER — the judgment that
   produces the idealized geometry — is ours, per the s62 research finding that no OSS ships it.
6. **Reversible like everything else.** The raw drawn polyline is kept as provenance (the drawn
   shape's `rawTracePx` equivalent); normalization strength is an adjustment, not a bake.

## Modules
```
src/lib/freeshape/
  ARCHITECTURE.md   this contract
  types.ts          StrokePoint (x, y, t, pressure?), DrawnStroke, NormalizeOptions, ShapeVerdict
  capture.ts        pointer events → resampled, de-jittered stroke (perfect-freehand under the
                    hood). Pure: points in, points out. Also the closure test (is this a loop?)
  classify.ts       DrawnStroke → ShapeVerdict: 'circle' | 'ellipse' | 'rect' | 'triangle' |
                    'blob' (+ confidence). Geometric tests + $1-style template match. Pure.
  harmonize.ts      THE normalizer. verdict + stroke → idealized VShape:
                    · circle/ellipse → true primitive fitted to the stroke's center/radii
                    · rect/triangle → straightened sides, squared corners (sharp — rounding is
                      the Radius knob's job, per the v5.3.1 birth philosophy)
                    · blob → Schneider fit + balance pass (engine smooth/simplify at fixed
                      strengths) → harmonious closed curve
                    Every output fold-guarded; a self-crossing result returns the prior valid fit.
  index.ts          one entry: strokeToShape(stroke, opts) → { shape: VShape, verdict } | null
                    (null = not a usable loop — open strokes are NOT this tool's job; the knife
                    gesture is a separate future sub)
```

## Wiring (the shell's side, not this folder's)
cutout-lab gains a **Draw mode**: comet-ink rendering while drawing (the same fading-trail
pattern as the AI pointer), release → `strokeToShape` → the result seeds the outline source →
the SAME v5.3.1 finishing pipeline (AUTO_TUNE default + all knobs + blend row) runs on it →
sticker preview fills the drawn shape with the image. Draw replaces the current outline
explicitly (it is a shape authoring act, not an edit of the AI cut).

## Acceptance gates (from Dan's evidence, 2026-08-05)
1. The green-blob sequence: Dan's wobbly closed "e"-loop → a clean balanced blob outline —
   NEVER a background selection (the 21:21 failure is impossible by construction: no AI).
2. A shaky near-circle → a true circle; a shaky quadrilateral → a straight-sided rect (sharp
   corners; Radius knob rounds on demand).
3. Zeroing the knobs on a drawn shape returns its raw fitted form — same reversibility contract
   as an AI trace.
4. An open (non-closing) stroke returns null and the shell says so — it never guesses a shape.
5. Runs entirely on-device with nothing downloaded; a full draw→normalize cycle under ~50ms on
   the phone (pure geometry budget).
