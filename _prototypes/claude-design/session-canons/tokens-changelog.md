# Token Changelog — backup/audit of every manual CSS token edit

> WHY: we are (temporarily) treating the local token CSS as the working SSOT while
> prototyping the real Creator screen. Figma + the converter are updated FROM here
> afterward. Every hand-edit to `tokens/*.css` is logged here so it's reversible and
> auditable if something in the CSS is wrong. NEVER edit `tokens/*.css` without an entry here.
>
> Format: date · file(s) · token · old → new · reason · who sanctioned.

## 2026-06-21 — Size scale off-by-one fix (semantic→alias)
- **Files:** `tokens/app-tokens.css`, `tokens/semantic.css`
- **Change (height + width):**
  - `--size-*-l`   48px → **40px**
  - `--size-*-xl`  56px → **48px**
  - `--size-*-2xl` 72px → **56px**
- **Reason:** semantic Size was wired one alias rung too high (`l→{xl}` instead of `l→{lg}`), skipping the 40 (alias `lg`) rung. User remapped Figma `3.6_Semantic_Size` 1:1 by POSITION (kept `s/m/l` spelling on semantic vs `sm/md/lg` on alias — intentional, to distinguish layers). CSS mirrored to match.
- **Sanctioned by:** user (remapped Figma first, asked to mirror in CSS).
- **Revert:** set l/xl/2xl back to 48/56/72.
- **Render impact:** none — nothing binds `var(--size-*)` in the prototype yet.

## 2026-06-21 — Component token: Round button size (renamed to convention)
- **Files:** `tokens/app-tokens.css`, `tokens/semantic.css`, `RoundButton.dc.html`
- **Token:** `--size-round-button: var(--size-height-l)` (40)
- **Convention (from `ds-source/naming-rules.json`):** component tokens SHARE their category prefix + append the component name (component colours fold into `--color-*`, e.g. `--color-slider-handle-bg`). So a component SIZE token = `--size-` + component → `--size-round-button` (was wrongly `--round-button-size`).
- **Sanctioned by:** user ("follow the token naming convention").
- **Revert:** delete the `--size-round-button` line.

## 2026-06-21 — Component token: Round button size
- **Files:** `tokens/app-tokens.css`, `tokens/semantic.css`
- **Added (component tier — names the specific component, references semantic):**
  - `--round-button-size: var(--size-height-l)` (40)
- **Reason:** size component token for the `RoundButton` component (cancel/done + small round controls). Single purpose; NOT a t-shirt scale (that's the semantic `--size-*` layer's job). Earlier wrong attempt `--size-control-{sm,md,lg}` removed.
- **Sanctioned by:** user (corrected Claude: component tokens name the component, not s/m/lg).
- **Revert:** delete the `--round-button-size` line.
- **Render impact:** RoundButton uses it; inline buttons not yet repointed.

## 2026-06-21 — Semantic Spacing STATIC family added (3.2.1)
- **Files:** `tokens/app-tokens.css`, `tokens/semantic.css`
- **Added:** two-tier — `--alias-spacing-static-*` (→ `var(--primitive-dimension-*)`) + `--spacing-static-*` (semantic → alias). 16 steps none/6xs…6xl = 0/1/2/4/6/8/10/12/16/20/24/32/40/48/64/80px. Alias EMITTED here (deviates from emitAlias=false) as the single swap point, per user.
- **Reason:** static elements (icons, tab bar, dock, dials) need STATIC inset (fluid inset wrong on fixed boxes). Single universal category (no inset/stack/inline split — static has no directional intent). Mirrors Figma `2.4.1_Alias_Spacing_Static` + `3.2.1_Semantic_Spacing_Static` the user authored.
- **Sanctioned by:** user (authored in Figma; hand-crafted into CSS — no reconvert needed).
- **Revert:** delete the `--spacing-static-*` block.

<!-- Append new entries ABOVE this line, newest first. -->

