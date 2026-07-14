# I0 gate — @s58-expert adversarial live-probe (2026-07-08)

HEAD 4e2f8ff (promote-element + write-scoped-declaration + ComponentModel read). Probed live on :3025
against an adversarial PROJECT throwaway (GateProbe, mixed unitless/length/var/shorthand props) — library
untouched (two-repo safe), both repos clean after, throwaway removed.

## VERDICT: I0 CORE PASSES — one required fix before I1 (build-authority conformance, not a rethink).

## PASS — verified live, not code-read alone
- **Converter (F1 anti-corruption core) — PERFECT.** Promoted a div with adversarial props; the generated
  `.module.css` is exactly React's render: LENGTH→px (`width:120px`, `padding:16px`, `border-radius:8px`),
  every UNITLESS prop RAW (`opacity:1`, `z-index:5`, `line-height:1.5`, `font-weight:600`, `flex-grow:1` —
  no spurious px), `var(--sem-col-surface,#fff)` verbatim, shorthand `border:1px solid #ccc` verbatim,
  camelCase→kebab throughout, child's inline style left untouched. This IS visual parity (R4) — the CSS
  provably equals what React rendered, established deterministically prop-by-prop, stronger than a pixel
  diff for the corruption question. (Pixel screenshot-diff on a rendered component available if wanted.)
- **promote-element:** inline style → `.base` rule + `className={styles.base}` + `import styles`; byte-exact,
  valid property access, tsc 0.
- **write-scoped-declaration — all 4 scopes write real CSS:** base, `.base.secondary` (variant),
  `.base:hover, …` (pseudo), `.base[data-loading]` (semantic). postcss-manipulated, parse-guarded.
- **ComponentModel round-trip — NO DRIFT.** With variant+hover+loading written, the read returns:
  rootClass=base, variants=[secondary/config], states=[hover/**interaction**, loading/**semantic**] —
  BOTH state kinds captured WITH names. The semantic-state drift bug s58-qa flagged is genuinely absent.
  (My first read showed name=null — MY probe error, read `.name` not `.state`; corrected.)
- **Idempotent re-promote → `noop:true`.** tsc 0, editor 200, both repos clean.
- **Two-repo discipline:** tested on a project throwaway (library never mutated); confirmed lib git clean.

## REQUIRED FIX before I1 (Finding A — MED, blocks the gallery preview I1 wires)
**The pseudo-state preview selector in the CODE diverges from the SIGNED blueprint.** `scopedSelector`
(lib.ts:185) emits `.base:hover, .base[data-preview="hover"]`. The final blueprint §3.2 (after s58-qa
REWORK Finding 2 + REWORK-NARROW Finding 2) specifies `.base:hover, :global([data-fc-preview="hover"]) .base`.
Two divergences:
1. **Wrong attr name:** `data-preview` vs the standardized `data-fc-preview`.
2. **Wrong FORM (the load-bearing one):** `.base[data-preview]` requires the attr ON the `.base` element,
   but the gallery renders `React.createElement(f.Comp)` inside a HOST frame [components-canvas:147-152] and
   can only set the attr on the WRAPPER → `.base[data-preview]` can NEVER match → the gallery cannot
   force-preview states. This is the EXACT "selector can't match the real wrapper" bug s58-qa caught in the
   blueprint and I fixed there — but the code was built to the pre-fix spec.
Impact: I0's own scope is fine (the `:hover` half ships correctly); but I1 wires the gallery state-preview
against this selector and it will silently not work. **Fix `scopedSelector`'s pseudo branch to the final
blueprint form** (`:global([data-fc-preview="<pseudo>"]) .base`, ancestor + correct attr) + update the
doc-comment lib.ts:179-180 (still describes the old form). Re-probe: a pseudo write emits the ancestor
selector; §9 dual-selector-strip test asserts the exact half.

## LOW note (not blocking)
- The semantic-state write returned 404 ONCE under three rapid back-to-back scoped writes to the same
  module (variant→hover→loading in immediate succession), then succeeded in isolation → likely a file-write
  race under rapid sequential writes to one CSS file. Single-write path is fine. Worth confirming the CSS
  write is serialized/atomic before the board fires many writes at once (I1+).

## Scope confirmation (designer's flag) — AGREED
I0's `write-scoped-declaration` writes the `.base[data-loading]` RULE (verified). The boolean `loading` PROP
+ className toggle is **I1's `add-state` (§3.5)** — my gate #4 "+its boolean prop" conflated them; the
prop-add is correctly I1, not I0. The ComponentModel reads the semantic state from the rule already, so I1
adds the driving prop on top. Confirmed.

## Disposition
I0 core is strong, real-code-grounded, byte-exact, no drift. Fold Finding A (selector→final-blueprint form)
+ note the LOW race, re-send; on the one-line selector fix re-verified, I0 PASSES → I1 (states, all 6).
This gate caught a real code-vs-signed-spec divergence self-verification missed — the blueprint-first
discipline working as intended.
