# ONEMO Figma Canon — how to author a file for ideal conversion

> The **input** contract, sibling to `SPEC.md` (the mapping) and `CODE-CANON.md` (the output).
> This is not a gate. **Every design converts fully** — the converter reproduces whatever the file
> says, in both modes (with and without canon). Canon is the **grade**: how clean the generated
> code is. A canon-conformant frame emits ideal React/CSS (semantic flexbox, every value a token);
> a non-canon frame still emits a faithful, pixel-matching screen — it just scores lower and the
> conformance report names exactly why. Author to canon and there is nothing to remediate.

## The one principle

**Structure and geometry are math and always convert.** The layer tree becomes the DOM tree 1:1;
positions, sizes, and rotation become CSS from Figma's own coordinates. Nothing here is required to
make a screen *appear* — it is required to make the *code* clean, token-bound, and editable.

## Grade dimensions (what the conformance report scores)

| Dimension | Top grade (canon) | Still converts (lower grade) |
|---|---|---|
| **Layout** | auto-layout everywhere → semantic flexbox (gap/padding/align) | no auto-layout → `position: absolute` from real coords (faithful, but not responsive/editable-as-flow) |
| **Tokens** | every value bound to a variable → `var(--token)` | raw value → emitted verbatim + listed in the report for one-click binding in react-figma |
| **Typography** | text bound to a type token → semantic tag (`h1`–`h5`) + token | raw font props → `<span>` + raw px |
| **Effects/strokes** | standard Figma effects + INSIDE/OUTSIDE strokes → clean CSS | see "genuine unmappables" below |

## Author for the top grade

1. **Use auto-layout on every container** that holds flowed content. It maps directly to flexbox
   (`display:flex` + direction/gap/padding/justify/align). Containers without it convert to absolute
   positioning — correct and pixel-faithful, but not editable as flow and not responsive.
2. **Bind every style value to a variable** — dimensions, colors, radii, spacing, typography. A bound
   value emits as `var(--token)`; an unbound value emits raw and shows up in the report. This is the
   single biggest lever on your conformance number.
3. **Bind text to typography tokens.** A bound size token drives both the value *and* the semantic
   tag (`display/*`→`h1`, `title/screen/*`→`h2`, `title/section/*`→`h3`,
   `title/product|headline/*`→`h4`, `body/heading/*`→`h5`). Unbound text stays a `<span>`.
4. **Name nodes meaningfully.** Names become CSS class names (camelCase, deduped). `button`/`*Button`
   → `<button>`; `nav`/`header`/`footer`/`main` → that landmark tag.
5. **Keep instances resolvable.** Component instances are flattened with their overrides applied.
6. **One image fill per image node**, no children on it → clean `<img>`; the original bytes are
   packaged (no recompression). A container with an image fill emits `background-image`.

## The genuine unmappables (avoid in Figma — no faithful CSS exists)

These are the *only* things the converter reports as truly unconvertible. They are **properties**,
never structure — the element still emits; just that one property lands in the report as a design
decision. Prefer the canon alternative:

| Figma construct | Why it can't map | Author instead |
|---|---|---|
| **GLASS effect** (Figma's proprietary material) | no CSS equivalent | `BACKGROUND_BLUR` (→ `backdrop-filter: blur()`) + a translucent fill — the standard glass recipe that *does* map |
| **GRADIENT_DIAMOND fill** | CSS has no diamond gradient | linear / radial / angular (conic) gradient |
| **CENTER stroke on a non-vector** | CSS borders are inside/outside only, no half-straddle | INSIDE stroke (`border`) or OUTSIDE (`box-shadow` ring); CENTER *inside a vector* is fine (renders in the svg) |
| **Gradient / non-solid stroke** on a non-vector | no faithful border paint | solid stroke, or move the shape into a vector |
| **Complex (non-rounded-rect) mask** | only rounded-rect masks → `overflow`/`clip-path` cleanly | a rounded-rect mask, or bake the mask into a vector |
| **Non-standard font style name** | weight table can't resolve it | a standard weight name (Thin…Black, optional `Italic`) |

Everything else — auto-layout, no auto-layout, rotation, negative spacing, standard effects, solid
and gradient fills, images, text — converts. Canon just decides whether it converts *beautifully*.

## Two-mode summary

- **With canon:** ideal code — semantic flexbox, fully token-bound, semantic tags, zero report items.
- **Without canon:** faithful code — same pixels, absolute where there's no auto-layout, raw values
  flagged for one-click binding, unmappable properties listed. Nothing is refused; nothing is faked.
