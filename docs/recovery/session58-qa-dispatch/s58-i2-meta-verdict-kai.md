# I2 (multi-axis config variants) — @s58-expert META verdict @ 3ac7ecf (2026-07-08)

Chain 0f7754d → 4180242 → 3ac7ecf, worktree clean. QA→Meta order (s58-qa 13/15 + 13/13 closure first;
ledgers s58-i2-qa-codex-4180242.md, s58-i2-closure-qa-codex-3ac7ecf.md). Method: full code-read of the I2
diff (lib.ts +254, unified model / composer / decompose / mintUnionProp / ensureAxisInClassName; page.tsx
shapeModel; components-canvas; editor-components) against signed §1/§3.2/§3.3/§6.1 + MEASURED live probes on
:3025 (fresh multi-axis throwaway; both repos clean after; tsc 0; editor 200). Independent — not a relay of
either lane.

## VERDICT: META PASS — I2 closes. ONE named finding (F-M5, silent reserved-prop axis) = REQUIRED fold at
## I3 START (it lives in `mint-union-prop`, which I3's expose-as-prop reuses with user-supplied names).

## (a) Unified model — HOLDS, no residual consumers
`ComponentModel` = ONE `rules: {selector, axisValues, semantic, pseudo?, legacyName?, decls}[]` list +
`variantAxes` (parsed FIRST from string-union props, so decompose has axis context — and an axis lists the
moment add-variant-axis runs, before any CSS rule, mirroring the I1 derive-from-prop pattern). Old
`variants`/`states` fields GONE. Consumer sweep: page.tsx `shapeModel` DERIVES its states view from
props+rules (semantic from boolean props w/ F-M2 root-tag branch; interaction from pure-pseudo rules) —
per the §0 note in lib.ts; components-canvas `group.variants` is a LOCAL Frame[] fed FROM `variantAxes`
(gallery frames, not the old model field); editor-components route reads `variantAxes`. No stale reader.
The lead's one-list call over a forked combinatorial array is architecturally right — I3/I4 read/write the
same rules list.

## (b) Combinatorial decompose — LOSSLESS, proven live
Wrote `{axisValues:[size_sm, style_ghost], semantic:[loading], pseudo:hover}` → rule
`.base.size_sm.style_ghost[data-loading]:hover, :global([data-fc-preview="hover"]) …` (F3 dual carried
into composite). READ decomposed it EXACTLY back: both axisValues, semantic [loading], pseudo hover, both
decls. Underscore-value edge: value `extra_large` → `.base.size_extra_large` decomposes to
{size, extra_large} (split-on-FIRST-`_` law holds; axis names can't contain `_` — 422 enforced, proven).
Legacy class `.base.secondary` (hand-authored) → `legacyName:'secondary'`, not dropped. §0 re-read-reflects-
truth holds for every scoped rule shape.

## (c) Composer determinism — a COMPOSER property, proven with scrambled input
Two writes to the same target with OPPOSITE axisValues orders ([style,size] then [size,style]) + different
props → BOTH landed in the ONE rule `.base.size_sm.style_ghost[data-loading]:hover` (sorted by variantAxes
index; semantic by STATE_ORDER; pseudo last), no near-miss duplicate rule. Implementation nuance (named,
not blocking): the axis-sort lives in `writeScopedDeclaration` (the public op — reads the .tsx sibling's
variantAxes and self-sorts ≥2 axes), semantic-sort in `scopedSelector` itself; determinism is proven at the
op surface, which is the one that matters. Fallback if the .tsx model is unreadable = caller order (named
edge; the .tsx always exists in practice since the op derives the path from it).

## Compile shape — the D1/CVA contract, byte-verified
add-variant-axis size + style produced EXACTLY §6.1:
`{ size = 'md', style = 'solid' }: { size?: 'sm'|'md'|'lg'; style?: 'solid'|'ghost' }` +
`className={[styles.base, styles[`size_${size}`], styles[`style_${style}`]].filter(Boolean).join(' ')}`
— defaulted destructure = the `?? defaultValue` fallback by construction (prop absent → default composes).
mint-union-prop CREATE/EXTEND/idempotent verified (extend merged extra_large into the union; re-run = no-op).
ensureAxisInClassName handles both simple `styles.base` and already-composed array forms.

## F-M5 — the adversarial catch (beyond both lanes): SILENT reserved-React-prop axis — REQUIRED fold at I3 start
`add-variant-axis {axis:'key'}` was ACCEPTED → minted `key = 'x'` as a destructured prop + `styles[`key_${key}`]`
in className. **tsc passes (0 errors) — but React never passes `key` to a component**, so the axis silently
NEVER switches at runtime (always the default). Fully silent failure: compiles clean, authoring UI looks
fine, instance `<Comp key="y"/>` does nothing. Same class: `ref`, `children`, `className`, `style` (style
MINTS today — my probe used it; it works because host-element style semantics don't apply to function-
component props, but it shadows the universal React style prop on instances = a consumer trap).
FIX (one line): `mintUnionProp` blocklist `{key, ref, children, className, style}` → 422. REQUIRED at I3
START, not I2 re-work: the primitive is shared, and I3's expose-as-prop feeds it USER-TYPED prop names where
this collision is far more likely. (Severity at I2 alone: LOW — an author naming an axis "key" is rare.)

## (d) PRODUCTION + FRAMER-PARITY verdict — multi-axis variants specifically
- **CVA-equivalence: GENUINE.** Independent union-typed props composing delta classes with default fallback
  IS the class-variance-authority pattern (variants map + defaultVariants), byte-shape verified against the
  §6.1 golden form. Two axes composing + a combinatorial state rule proven on disk — `size × style` together,
  not just tested separately.
- **Framer-parity: MATCHES the real mechanism.** Framer delivers combining dimensions via multiple Enum
  property controls (s58-framer-CODE-model §3; its `Variants` map is flat/single-set §1.1) — ours = N union
  props, same authoring capability, static-CSS output. Framer's single variant-set = our N=1 (same shape,
  proven — no special case).
- **Production level: YES for the write/read substrate** — deterministic, lossless, refusal-guarded (axis
  422s), idempotent. Named boundaries: F-M5 blocklist (I3 entry), delta-discipline is caller-enforced (the
  op overwrites a decl in the most-specific rule; no cross-rule dedup — per blueprint, fine), board UI (I5)
  and instance-attr writes (I3 set-instance-prop) are still ahead — this is the ENGINE for variants, the
  full authoring surface completes per the increment plan.

## Hygiene
Probe fully removed; engine worktree + onemo-component-library both `git status` clean; tsc 0 (with AND
after probe); editor 200. Two-repo discipline held.

## Disposition
I2 = QA PASS + META PASS → closes. I3 (props/expose-as-prop) unblocks WITH one entry requirement: fold the
F-M5 reserved-prop blocklist into mint-union-prop as I3's first commit (it's I3's own primitive). Nothing
Done — Dan's gate.
