# Brief — Creator Editor Component Tokens (`4.0_Component_Colours`)

**For:** DS team / Claude Code working in `onemo-ssot-global` (Figma vars) + `onemo-next` (`scripts/tokens/build-tokens.mjs`)
**From:** prototyping (ONEMO Creator Studio screen + token-inspector dash)
**Goal:** make the Creator-editor surfaces consume **real, exported component tokens** so the React package is portable, theme-correct, and passes the "never skip a layer" rule.

---

## 1. Problem

The Creator editor (Add/Shape/Effect/Tune/Edit screen) was prototyped with a local `--editor-*` token layer. Auditing it against the DS (live cascade resolver in the dash) shows most of these **violate the layering rule** — they hardcode hex or jump straight to primitives, skipping semantic:

| `--editor-*` token | current value | verdict |
|---|---|---|
| `--editor-dock-bg` | `#071013` (hex) | ✗ hardcoded, no token |
| `--editor-fg` | `var(--primitive-color-blue-green-12)` | ✗ component → primitive (skips semantic) |
| `--editor-accent` | `var(--semantic-fg-brand-secondary)` → blue-green-9 | ✓ compliant (reference pattern) |
| `--editor-glass-bg`, `--editor-circle-bg`, `--editor-bezel-bg`, `--editor-viewer-bg`, `--editor-dock-border`, `--editor-swatch-shadow`, `--editor-elevation-*`, `--editor-tool-track`, `--editor-stage-bg`, `--editor-grain-opacity` | translucent / material / gradient literals | ✗ no semantic home → **genuinely missing component tokens** |

These are not bugs in the generated CSS (that's correct) — they're **component tokens that don't exist in Figma yet** (`4.0_Component_Colours` is essentially empty). My local layer is a stand-in.

## 2. Ask

**Author a `4.0_Component_Colours` group `creator-editor/*`** (and `5.0_Effects` entries for the shadows), each **referencing a semantic token**, so the converter exports them as `--color-creator-editor-*` / `--semantic-*`. Proposed mapping (component → semantic intent):

| Component token (proposed) | Semantic reference | Notes |
|---|---|---|
| `creator-editor/control-ink` | `text/primary` *(or a new `text/control` slate)* | replaces `--editor-fg`; UI-BRIEF wants cold slate `#2C3A4A`, not pure black — may need a semantic `text/control` |
| `creator-editor/control-ink-disabled` | `fg/disabled` | already aligns (grey-8) |
| `creator-editor/accent` | `fg/brand-secondary` | already compliant |
| `creator-editor/accent-ring` | `border/brand` | |
| `creator-editor/accent-value` | `border/brand-alt` | |
| `creator-editor/dock-surface` | `bg/overlay` (brand-black-constant) | dock pole `#071013`, theme-constant |
| `creator-editor/dock-ink` | `fg/white` | |
| `creator-editor/dock-ink-muted` | `fg/white` @ alpha → **needs an alpha primitive or component alpha** | white α; no semantic alpha today |
| `creator-editor/glass-surface` | **needs translucent-white semantic** | glass controls; no `bg/*` is translucent |
| `creator-editor/glass-border` | **needs translucent-black semantic** | |
| `creator-editor/stage-bezel` | `#20252b` → primitive grey/dark | stage bezel; map to a grey step |
| `creator-editor/viewer-material` | gradient | brand-pattern moment; component gradient token |
| `creator-editor/app-stage` | ice-blue→paper gradient + noise | brand-pattern; component gradient + grain |

**Shadows → `5.0_Effects`:** `creator-editor/elevation-control`, `creator-editor/swatch-inset`, `creator-editor/stage-elevation` (currently `--editor-elevation-1` / `--editor-swatch-shadow` literals).

## 3. Decisions needed from DS team

1. **Translucent / alpha values** (glass surfaces, white-α dock ink): the semantic palette has no alpha tokens. Either add alpha primitives (`base/white-a10…`) + semantic glass roles, or accept these as component-only literals. **The dock glass + control glass cannot be made compliant without this.**
2. **Slate control ink:** UI-BRIEF specifies CTA/control label `#2C3A4A` (cold slate), not `text/primary` black. Add a semantic `text/control` (or `fg/control`) so it's not a one-off.
3. **Component non-color tokens:** there's no collection for component-specific sizes/radii (61px tab-bar, 1.5px rim, 46px phone radius). Confirm these stay as structural literals (not tokens) or warrant a `4.x_Component_Dimensions`.
4. **Alias emission:** keep `emitAlias=false` (alias stays Figma-internal) — confirmed; the inspector reads the alias tier from the Figma JSON, not CSS. No change needed unless you want alias visible at runtime.

## 4. Converter status (already verified)

- `build-tokens.mjs` **routes & emits** `4.0_Component_Colours` (folded into `--color-*`/`--semantic-*`) and `5.0_Effects`. No converter change required for component **colors/effects**.
- No handling for component **dimensions** (no such Figma collection) — see decision #3.

## 5. Definition of done

- Creator-editor surfaces consume `--color-creator-editor-*` (exported, theme-flipping).
- Token-inspector dash shows every Creator-editor element resolving **component → semantic → (alias, internal) → primitive → raw** with a ✓ compliance flag.
- React package import carries the full set, true and portable.
