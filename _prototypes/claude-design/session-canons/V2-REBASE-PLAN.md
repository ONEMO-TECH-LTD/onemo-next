# V2 DS RE-BASE PLAN — prototype v1 → DS-V2-22-JUNE-2026

> Source of v2: `s57-variables-gui` worktree → `tools/ds-pipeline/output/tokens.css` (scan-driven, structural names).
> Copied into project: `tokens-v2/tokens.css` (+ light/dark JSON), `ds-source/DS-V2-22-JUNE-2026.json`.
> ⚠ v2 is WIP — converter QA re-verify still open (NO-SHIP→rework). Re-basing now tracks a moving target; names/values may shift.
> Approach (user's stated preference): SECTION BY SECTION, sanity-check each, not a blind sweep. Token-file swap + mechanical color/dim/radius renames can be one safe sweep; spacing/type/editor re-wire is per-section.

## v2 structure (one file, all tiers + `[data-theme="dark"]` block, class-based dark ✓)
- **Primitives:** `--prim-col-*` (was `--primitive-color-*`), `--prim-dim-N` (was `--primitive-dimension-N`, same N), `--prim-ratios-*` (NEW — line-height primitives).
- **Semantic colors:** `--sem-col-{text,fg,bg,border}-*` (was `--semantic-*` AND the `--color-*` inline aliases — both collapse here, by sub-name).
- **Semantic spacing:** `--sem-space-{nano,standard,big,huge}-{xs,s,m,l,xl,2xl}` — RE-BANDED. `standard-m = 16` (mobile-first). inset/stack/inline split is GONE.
- **Semantic size (static):** `--sem-size-{2xs,s,m,l,xl,2xl}` = 16/24/32/40/48/56.
- **Semantic radii (static):** `--sem-radii-{none,xxs,xs,sm,md,lg,xl,2xl,3xl,4xl,full}`.
- **Semantic border width (NEW):** `--sem-border-{xs,s,m,l,xl}` = 1/2/4/6/8px. → CTA 8px stroke = `--sem-border-xl`.
- **Semantic containers:** `--sem-container-*`.
- **Semantic type (composite, decomposed):** `--sem-type-{group}-{variant}-{font,style,size,line-height,letter-spacing,paragraph-spacing}`. Groups incl. `body-{heading,normal,strong,caption}`, plus title/display (verify). Was `--text-*` composites.
- **⚠ Comp tier DELETED:** no `--comp-*`, and the component-colour semantics we used are GONE: `text-editor-icon-fg(-active)`, `footer-button-fg(-hover)`, `slider-handle-bg/border`, `toggle-*`, etc. → `--editor-*` must re-point to BASE semantics.

## Mechanical renames (safe global swap, value-preserving)
| v1 | v2 |
|---|---|
| `--primitive-color-X` | `--prim-col-X` |
| `--primitive-dimension-N` | `--prim-dim-N` (same N) |
| `--semantic-COL` / `--color-COL` | `--sem-col-COL` (COL = text-*/fg-*/bg-*/border-*) |
| `--radius-X` | `--sem-radii-X` (remap names: 0→none, 2→xxs, 4→xs, 6→sm, 8→md, 10→lg, 12→xl, 16→2xl, 20→3xl, 24→4xl, full→full — VERIFY against px) |
| `--size-X` | `--sem-size-X` (16→2xs, 24→s, 32→m, 40→l, 48→xl, 56→2xl) |

## Semantic restructure (per-section, decide intended px)
- **Spacing:** map each v1 `--spacing-*` / inset/stack/inline by INTENDED px → `--sem-space-{band}-{size}`:
  - 4→nano-m · 6→nano-l · 8→nano-xl · 12→standard-xs · 16→standard-m · 20→standard-l · 24→standard-xl · 32→big-xs · 40→big-s · 48→big-m · 56→big-l · 64→big-xl · 72→huge-xs …
  - (nano-xs=1, nano-s=2, standard-s=14, standard-m=16; confirm each against the v2 file values.)
- **Type:** v1 `--text-{role}` → v2 `--sem-type-{group}-{variant}-*`; apply per-property (font/size/line-height/letter-spacing) since v2 is decomposed.
- **`--editor-*` re-wire:** re-point the deleted component-colour refs to base sem-col:
  - `text-editor-icon-fg` → `--sem-col-fg-secondary`; `_active` → `--sem-col-fg-primary`
  - `footer-button-fg` → `--sem-col-text-brand-secondary` (dock labels)
  - `slider-handle-bg` → `--sem-col-bg-primary`; `slider-handle-border` → `--sem-col-border-brand`
  - dock ink white → `--sem-col-text-white` / `fg-white`; dock-bg #071013 → `--prim-col-base-brand-black` (or a sem bg)

## Files touched by the re-base
1. `tokens/` → replace with v2 `tokens.css` (single file). Update helmet `<link>`s in: dash, Creator Studio, RoundButton, all storybooks.
2. `Creator Studio.dc.html` — `--editor-*` layer re-wire + any direct `--spacing-*/--radius-*/--primitive-*/--size-*` refs.
3. `RoundButton.dc.html` — `--size-*` → `--sem-size-*`; 8px stroke → `--sem-border-xl`.
4. `Creator Polish - Tokens WIP.dc.html` (dash) — resolver: `_tier`/`_chain` prefix regex (`--primitive-`/`--semantic-`/`--editor-` → `--prim-`/`--sem-`/`--comp-`), dropdown token lists, WSEM/WPRIM maps, viewport-sim (still reads `vi` — unaffected).
5. Storybooks — token refs (lower priority).

## Open decisions for user
1. Proceed against WIP v2 NOW (re-verify pending), or wait for QA-passed v2?
2. Sweep-then-verify (mechanical renames in one pass, then per-section spacing/type/editor) vs pure incremental section-by-section?
3. Spacing band mapping: confirm the px→band table above (esp. 20px → standard-l vs big, and the nano/standard cutoffs).
