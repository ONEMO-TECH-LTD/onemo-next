# Compiler v2 — §14.1 Microfixture Design Spec (P0 · design only, generators HELD until QA CLEAR)

> Maps every C11 v3 §14.1 row + evidence row E1–E13 to an exact fixture specification. Synthetic
> REST-schema snapshots are LEGAL here (§14.1 only — joint route); §14.2 integration evidence is
> plugin-origin and out of scope for this file. Each fixture ships as a sealed snapshot directory
> (built through `writeSnapshot` — the same code path as live capture, one law) plus a mutation
> twin. "Baseline bite" = the legacy converter (6c36475) must exhibit the E-row defect on this
> fixture; "gate bite" = the named v2 gate must fail the mutation twin.
> Status: SPECIFICATION. Generator code is held pending Meta CLEAR of the current frozen foundation checkpoint.

| ID | v3 §14.1 row | E-row | Content shape | Gate bite (mutation twin) | Baseline bite |
|---|---|---|---|---|---|
| MF01 | 1 compacted vs carrier-local | E1 | root FRAME: fills=[IMAGE, SOLID(bound)] + compacted bv.fills len 1 | G2: drop carrier-local read → missing binding | bakes hex + invert hack |
| MF02 | 1/2 gradient stops | E2 | 1 gradient fill, 2 bound stops, bv.fills flattened len 2 | G2: swap the two stop variable ids → identity fail | stops baked |
| MF03 | 2 paint stacking | E9 | 3 fills: image top, solid mid (bound), solid bottom, per-paint opacity + blendMode | G7: reorder paints → render-graph order fail | stack inverted |
| MF04 | 3 strokes | E5 | per-side bound widths + CENTER align + dash pattern | G2/G6: drop one side's binding → conservation fail | per-side widths raw |
| MF05 | 4 effects | E3 | DROP_SHADOW with radius/spread/color/offsetY each bound to DISTINCT vars + one repeated var across two slots | G2: dedupe repeated var to one record → record-count fail | all effect bindings raw |
| MF06 | 5 masks/clips | — | alpha mask + luminance mask + nested clip + isolation group | G7: drop mask group boundary → scene-oracle fail | mask semantics lost |
| MF07 | 6 transforms | E6 | asymmetric container rotated +90; sibling rotated −90; pure mirror [[-1,0],[0,1]]; shear matrix; nested transform | G6: reduce matrix to angle → geometry fail | rail mirrored; shear dropped |
| MF08 | 7 layout | — | H/V auto-layout, wrap, negative gap, GRID with spans, reverse-z, strokes-in-layout | G6: drop grid span / reverse-z → layout fail | GRID degrades to absolute |
| MF09 | 8 text | E13 | mixed ranges (2 unequal styled runs), list, hyperlink, emoji/surrogate pair, range-bound fill, alignY CENTER fixed box | G5: merge unequal runs → text-identity fail | runs collapse to node style |
| MF10 | 9 variables | E11 | local + remote id + extended collection, default/descendant modes, alias cycle, var with NO web syntax, name-collision pair | G3: resolve under root mode for descendant → mode fail; cycle → trace fail | modes/aliases unmodeled |
| MF11 | 10 components | — | COMPONENT_SET (2 variant axes), BOOLEAN/TEXT/INSTANCE_SWAP props, nested refs, instance with override + swap | G4: flatten instance → component fail | instance flattened silently |
| MF12 | 11 security | — | SVG with script/foreignObject/remote url; CSS injection in token web-syntax; path traversal asset name | G8: any payload survives sanitizer → security fail | payloads pass through |
| MF13 | 12 degradation | E12 | missing font bytes; unsupported effect type; unknown visual field; stale asset hash | G0/G1: unknown field continues → capability fail | silent skip, zero refusals |
| MF14 | 13 FLOAT domains | E4 | ONE float var bound to width (length), opacity (0–100), and unitless count + cross-domain alias | G3: single css channel reused across domains → grammar fail | opacity baked raw |
| MF15 | 14 react-plane bindings | — | STRING→characters, BOOLEAN→visible, var→componentProperties | G2: emit as inert CSS text → wrong-plane fail | bindings invisible |
| MF16 | 15 mode scopes | — | root mode + two nested explicit overrides + one collection on default mode | G10: drop scope marker → runtime context fail | overrides ignored |
| MF17 | 16 references | E12 | state with reference:null beside authored-reference state | G11: promote null-reference state → verdict fail | fire-and-forget capture |
| MF18 | 17 capture integrity | — | dependency changing between fingerprint passes; mutation attempt during capture; external-backdrop dependency omitted | G0: any → FAILED_CAPTURE | n/a (no capture law) |
| MF19 | 18 editor round-trip | — | EC1–EC8b fixtures per EDITOR-CORPUS.md | G13 per corpus | n/a (no editor gate) |

## Fixture package law

- Each MF ships: `snapshot/` (sealed, schema-valid, census-true), `expected.json` (canonical
  classifications, binding-record multiset, expected dispositions), `mutations/*.patch.json`
  (the twin edits), and a README naming its contract rows.
- Sanitization: no ONEMO token names in MF fixtures (agnosticity — arbitrary names by design);
  MF10 explicitly uses non-ONEMO collection names with no web syntax.
- Supplement-backed rows (MF09–MF11, MF15, MF16) carry synthetic `supplement.json` marked
  `sourcePlane: fixture` — legal for §14.1 parser/lowerer/gate tests, NEVER admissible as §14.2
  integration or live-capture (G0) evidence (joint route).
