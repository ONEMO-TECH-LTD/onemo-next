# I3 (props / expose-as-prop) — @s58-expert META verdict @ 7d67ac4 (2026-07-08)

Chain a5b956a → 9523737 → 0161941 → 523481e → 0e55ce7 → 7d67ac4, worktree clean. QA→Meta order (s58-qa
initial FAIL + closure PASS first). Method: full code-read of the I3 diff (lib.ts +181: addStringParam,
exposeStringPropOnRoot, exposeModuleCssBridge, exposeAsProp 4-route, setInstanceProp; page.tsx props panel)
against signed §5 + MEASURED live probes on :3025 — server API probes AND browser computed-style measurement
on a rendered 4-case precedence page (my own tab). Both repos clean after, tsc CLEAN, editor 200.

## VERDICT: FAIL-with-findings — ONE BLOCKING defect (F-M7). The bridge (the §5 core) is EXCELLENT and
## precedence is proven live; the literal-swap routes destroy existing renders. Bounded fix, not a rethink.

## (a) §5 PRECEDENCE — PROVEN LIVE, measured computed styles (the core gate)
Probe: base `color:#111111` + variant delta `.base.tone_hot color:#cc0000` → exposed `textColor`
(module-css). Generated CSS exact: `.base{color:var(--textColor,#111111)}`,
`.base.tone_hot{color:var(--textColor,#cc0000)}` — EVERY declaring rule bridged, each keeping ITS OWN
literal fallback (the folded F1 contract). Live computed styles on a 4-case page:
- `<P/>` → rgb(17,17,17) (base) · `<P tone=hot/>` → rgb(204,0,0) (variant BEATS base, prop unset)
- `<P tone=hot textColor=#00f/>` → rgb(0,0,255) (explicit prop WINS in variant view)
- `<P textColor=#00f/>` → rgb(0,0,255) (wins in base view)
**explicit prop > variant > base — MEASURED, not asserted.** The undefined-default + per-rule-fallback
design compiles to exactly the claimed precedence. This is the §5 crux and it's genuinely right.

## (b) 4-route signature + refusal taxonomy — REAL, all probed
- text: single-static-text → `{prop}` ✓ swapped; element with child elements → 422 "non-text children
  (ambiguous)" ✓.
- attr: string-literal href → `href={prop}` ✓; expression-bound attr → 422 "would clobber a binding" ✓.
- inline-style: numeric literal fontSize → prop ref ✓; dynamic expression → 422 "would destroy a binding" ✓.
- module-css: the bridge ✓ (a); zero-decl cssProp → 422 ✓; already-bridged decls skipped (a repeat expose
  422s "no declaration" BEFORE the prop-collision 409 can fire — the 409 exists in addStringParam and both
  file writes happen only after both transforms succeed = atomic; masked-409 is a harmless ordering nuance,
  noted).

## (c) CSSProperties cast — idempotent ✓; scope tradeoff named
Second expose on the same component: ONE `import type { CSSProperties }`, ONE cast, both `--` vars merged
into the one object (`{ '--pad': pad, '--textColor': textColor } as CSSProperties`) — no double-cast/import,
proven on disk. tsc 0 with the generated output.
ADVERSARIAL (measured): the cast DOES swallow typo'd keys — `{ colr:'red', paddin:12 } as CSSProperties`
compiles with ZERO tsc errors. For machine-generated objects that's acceptable (the generator controls the
keys), but when the cast wraps a PRE-EXISTING hand-authored style object it removes excess-property checking
from those keys too. LOW, named: the tighter pattern is a typed alias
(`type CSSVars = CSSProperties & Record<\`--${string}\`, string|undefined>`) used as an annotation, which
keeps checking. Improvement, not a blocker.

## (d) set-instance-prop — proven
INSERT `<PropProbe/>` → `<PropProbe textColor="#00aa00"/>` ✓; UPDATE → value replaced, count stays 1 (no
duplicate attr) ✓; host element (`div`) → 422 "host element, not a component instance" ✓; expression-needing
value (`{dyn}`) → 422 "out of v1 scope" ✓.

## (e) Reserved-name blocklist (F-M5) — enforced at ALL 3 mint points, probed
expose-as-prop 'ref' → 422 ✓ · add-variant-axis 'children' → 422 ✓ · set-instance-prop 'key' → 422 ✓.
Blocklist also covers dangerouslySetInnerHTML/defaultValue/defaultChecked — good extension beyond my list.

## FINDINGS

### F-M7 — BLOCKING — literal-swap routes DESTROY the original value for every prop-less consumer
The swapped literal is NOT carried as the param default (`addStringParam` adds a bare optional). PROVEN
LIVE in the browser: after exposing text/attr/inline-style, ALL renders without the new prop show
`spanText: ""` (original "probe text" GONE), `href: null` (link broken), fontSize fallen to inherited 16px
(13px literal gone). Exposing a prop is supposed to be a REPRESENTATION change (R4-grade: existing renders
unchanged, new knob added); this changes/destroys rendering everywhere the prop isn't passed — on a real
component (mother-v2 text, a CTA href) it blanks live content the moment you expose it.
Contract: the input authority (architecture §3, designer-locked) says "default = the current literal,
serialized by controlType"; §5's `default undefined` is load-bearing ONLY for the module-css bridge (where
each rule's CSS fallback preserves the literal — undefined is what makes variants win). The literal-swap
routes have NO CSS fallback, so the literal MUST become the param default:
FIX: text → `{ label = 'probe text' }`; attr → `{ shopUrl = 'https://…' }`; inline-style →
`{ labelSize = '13px' }` (careful: a NUMERIC literal like `fontSize: 13` must serialize to the RENDERED
form — 13→'13px' via the §2.1 converter's unitless/length law, or stay a number prop — spec the choice).
`addStringParam` gains a `defaultLiteral?` arg used by the 3 literal-swap routes; module-css KEEPS
default-undefined (correct there). Gate: re-run my browser probe — all 4 prop-less renders byte-identical
to pre-expose.

### F-M6 — REQUIRED (same rework commit) — bridge rule-filter false-matches sibling classes by prefix
`rule.selector…startsWith('.' + rootClass)` matched my planted `.baseline{color:#00ff00}` → it got bridged
(`var(--textColor, #00ff00)`) — the op even reported "3 rules bridged" counting the foreign class. A foreign
class inside the component's DOM subtree would then wrongly pick up the component's `--textColor`. One-line
fix: after the `.${rootClass}` prefix, require the next char ∈ {`.`, `[`, `:`, whitespace, end} (a boundary
check), so `.base`≠`.baseline`. LOW-MED (needs prefix-collision naming), but silent when hit.

### LOW notes (non-blocking, named)
- The masked module-css 409 ordering nuance ((b) above).
- CSSProperties cast scope ((c) above) — typed-alias improvement.
- set-instance-prop value validation blocks `{}<>"` but allows single quotes — fine for JSX double-quoted
  attrs, note only.

## (f) PRODUCTION + FRAMER-PARITY verdict — props capability
- **The bridge (Color/Number/style props — Framer's core controls) is production-grade and proven**: F1
  every-declaring-rule precedence measured live, clean generated code, idempotent, atomic writes. This is
  the hard 80% of §5 and it's right.
- **Instance overrides** (Framer's per-instance props) work: insert/update/refuse semantics proven.
- **Literal-swap routes (String/Link/Image controls) FAIL production today** — F-M7 makes "expose text as
  prop" destructive on a real surface. Framer's addPropertyControls carries `defaultValue` per control
  [CODE:framer §3] — parity REQUIRES the default. Until F-M7 lands: parity on style-props YES, parity on
  text/attr props NOT YET.
- controlType coverage matches §5's IN-list increment order (String/Color/Number/Link paths exist; Enum via
  I2's mint-union-prop; Boolean via I1's add-state path) — consistent with the no-27-parity-claim wording.

## Disposition
FAIL-with-findings → Ready for Builder: F-M7 (blocking) + F-M6 (same commit). Both bounded — an arg on
addStringParam + a boundary regex; no architecture change. My re-gate re-runs: the 4-case browser probe
(prop-less renders byte-identical pre/post expose), the `.baseline` non-bridge check, and the (a)
precedence gate unchanged. I4 stays HELD. Hygiene: probes fully removed (incl. stale .next type stubs),
both repos clean, tsc CLEAN, editor 200. Nothing Done — Dan's gate.

---
# META RE-VERIFY @ 8978fa6 — F-M7 + F-M6: **PASS, I3 META-CLEARED**

Method: fix-diff read (addStringParam defaultLiteral arg; the 3 swap routes pass the swapped literal —
text/attr via JSON.stringify, numeric inline-style serialized per REACT_UNITLESS length-law; module-css
passes NO default, comment states why; F-M6 boundary check rejects `[\w-]` after the prefix) + MEASURED
browser pre/post-expose comparison on the same 4-case page (independent of QA's fixtures + designer).

## F-M7 — CLOSED, proven live with a TRUE pre/post snapshot
PRE-expose captured, then all 4 exposes run, then POST-expose measured:
- Prop-less renders BYTE-IDENTICAL: spanText "probe text" (was "" before fix), href
  "https://onemo.fashion" (was null), spanFontSize "13px" (numeric 13 → '13px' per §2.1 law, was 16px
  inherited), base rgb(17,17,17) / variant rgb(204,0,0) unchanged.
- Generated defaults exact: `label = "probe text"`, `shopUrl = "https://onemo.fashion"`,
  `labelSize = "13px"`; **textColor (bridge) correctly has NO default** — the undefined-default/
  variants-win contract regression-checked: precedence re-measured, explicit prop rgb(0,0,255) wins in
  BOTH views, variant still beats base when unset. Representation-only expose, new knob works.

## F-M6 — CLOSED, proven live
Planted `.baseline{color:#00ff00}` sibling: bridge reported "2 rules bridged" (was 3), `.base` +
`.base.tone_hot` bridged with own fallbacks, `.baseline` UNTOUCHED (literal intact).

Hygiene: probes + stale .next type stubs removed, both repos clean, tsc CLEAN, editor 200. (One transient
mid-probe: a dev-server recompile returned an HTML 404 for one API call — retried, fine; not a code defect.)

## VERDICT: I3 (props) = META PASS @ 8978fa6. QA + Meta both clear (second pass).
Props capability: style-props (bridge) production-grade with measured precedence; text/attr/inline-style
now representation-safe; instance overrides + blocklist + refusals all hold. I4 (connectors) unblocks.
Nothing Done — Dan's gate.
