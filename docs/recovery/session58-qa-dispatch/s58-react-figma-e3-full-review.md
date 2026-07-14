# react-figma E3 (full build) — Meta + Execution Review (s58-lead)

Reviewer: Kai (s58-lead). Requested by s58-designer. Range: `1bf38d2..61b85d8` (14 commits).
Parallel: @s58-meta-qa (Codex) running the adversarial sweep — this is the meta + live-probe pass.
Method: read the 4 changed files (page.tsx +426, lib.ts +136, 2 new API routes), probed the new
write ops LIVE on :3025 with parse-checks, verified findings against the COMMITTED HEAD (not the
working tree — the designer is actively editing under me). Scratch files removed; tree left as found.

## Execution-verified GOOD (credit first)
- ✅ **`makeComponent` free-identifier scope analysis is genuinely senior-level** — walks the subtree,
  collects bound vs free identifiers (excludes JSX prop names, object keys, member names, intrinsic
  lowercase tags), and REFUSES (422) if the selection references local scope not covered by a
  top-level import. That's the hard, careful part done right.
- ✅ **`editor-tokens` endpoint = exactly Dan's traceability ask** — real DS tokens with full
  chain: `path` (`primCol / base / white`) ↔ `cssVar` (`--prim-col-base-white`) ↔ `value` (oklch)
  ↔ `dark` mode override ↔ `group` ↔ `kind`. Read-only, degrades gracefully if tokens.ts unparseable.
  Verified live: returns the real token set with Light+Dark.
- ✅ **`editor-image` route** dev-guarded, `basename`+sanitize (no path traversal), collision-safe
  suffix, extension allowlist, jailed to `public/uploads/react-figma/`.
- ✅ CSS/style/text ops from E1–E3 unchanged and still guarded (409, literal-only, jail, expectRaw).

## Findings

### F1 · HIGH · structural ops emit UNPARSEABLE code with `ok:true` — no output parse-guard
`duplicate-jsx`, `delete-jsx`, `make-component` splice the AST and write **without re-parsing the
result**. Confirmed on committed `61b85d8`: **0 `parseDiagnostics` checks in lib.ts** — every
`createSourceFile` parses the INPUT, none validates the OUTPUT. Every CSS/style op in this engine
guards (the whole in-memory-tagging architecture exists to never corrupt source); these three don't.
Probed live, each returns 200 `ok:true` but breaks the file:
- **duplicate-jsx** on a sole-return `<div/>` → `return <div/>\n<div/>` = adjacent JSX (needs a
  fragment) → **1 parse error**.
- **delete-jsx** of a sole child → empty `return ( )` → **1 parse error**. (Also unguarded:
  deleting the element inside `{cond && <el/>}` → `{cond && }`.)
- **make-component** name `"123 box"` → `<123box2 />` + `export function 123box2()` → **9 parse
  errors** (JS identifier can't start with a digit).
The trap: user clicks Duplicate/Delete/Make-component, sees success, their build then fails to
compile — silent source corruption, the exact class this architecture was built to prevent.
**Fix:** after the splice, re-parse the result string with `ts.createSourceFile`; if
`parseDiagnostics.length > 0`, refuse (422, "edit would produce invalid JSX") and do NOT write.
For make-component also sanitize the name to a valid identifier (PascalCase, prefix if digit-first,
non-empty). **Note:** the designer is ALREADY fixing the make-component identifier half in the
working tree — confirm the parse-guard covers all THREE ops (duplicate + delete too), not just naming.

### F2 · MED · `.svg` in image-upload allowlist = stored XSS
Committed `OK_EXT` includes `.svg` (route.ts:13); uploads land in `public/` served same-origin, and
an SVG can carry `<script>` → stored XSS on the dev origin. Dev-only mitigates severity, but it's a
real hole. **Fix:** drop `.svg` from the raster-upload allowlist (SVG-as-code belongs to the inline
`<svg>` path, not file upload). **Note:** the designer already removed `.svg` in the working tree —
confirm it lands in the committed fix.

### F3 · LOW · make-component doesn't dedupe instances
Extracting an element used in N places creates one component + one `<Name/>` instance; the other
N−1 usages stay inline. This is the explicitly v1-punted component-vs-instance problem — acceptable,
but the report/label shouldn't imply a reusable component was propagated. Note only.

## Verdict: REWORK-with-findings
F1 is the blocker — three structural ops silently ship unparseable source, breaking the engine's own
core "never corrupt source" guarantee (probed, 3 cases). F2 in the same pass. The rest — the scope
analysis, the token traceability endpoint, the image jail — is strong, and the designer is already
mid-hardening. Re-route to me for closure once the parse-guard covers duplicate + delete +
make-component; I'll re-probe the exact three cases at a named HEAD. Codex's adversarial verdict
stands independent.

---

## LOCKED CLOSURE — 2026-07-04 (s58-lead) · frozen HEAD c7827e2

Re-probed every case live at the named HEAD (tree clean, probes removed):

| Case | @c7827e2 | Verdict |
|---|---|---|
| F1 duplicate sole-return `<div/>` | **422** "invalid code (1 parse error)", file unwritten (0 errors) | ✅ CLOSED |
| F1 delete returned-root | **422**, file unwritten | ✅ CLOSED |
| F1 make-component digit-first `"123 box"` | **200** → `<C123box />` (prefixed, valid identifier, 0 errors) | ✅ CLOSED |
| F1 happy-path (duplicate valid nested child) | **200**, no over-refusal — guard doesn't block legit ops | ✅ no regression |
| F2 malicious `.svg` upload | **422** "unsupported image type"; `.svg` gone from committed OK_EXT (line 15) | ✅ CLOSED |

**Root fix quality:** `assertValidTsx` (lib.ts:246) re-parses the OUTPUT, refuses 422 on any
`parseDiagnostics`, wired into all 5 splice sites (make-component validates both the new file AND
the mutated source before writing either). One guard hardens every structural op — current and any
future create-op inherits it. Exactly the right architectural fix, not a per-op patch. tsc 0.

F3 (instance-dedup) remains the accepted v1 component/instance punt — unchanged, correct.

## VERDICT: PASS — E3 full build closed at named HEAD c7827e2. All findings execution-verified.

---

## s58-meta-qa addendum — 2026-07-04 · frozen HEAD c7827e2

Reviewer: Codex `s58-meta-qa`. Requested by `@s58-designer`. Verdict target was frozen HEAD
`c7827e2` on branch `session58-task/react-figma-engine`, worktree
`onemo-next/.claude/worktrees/s58-figma-engine`, dev server `:3025`.

### Verdict

**FAIL-with-findings.** The write-safety, production-purity, token traceability, layout-guide, toast
smoke, and SSR-safety gates passed, but the "29/29 inspector controls write a real CSS/structural
analog" claim is false for at least the main Auto layout Flow segmented control.

### Findings

1. **HIGH — Auto layout Flow segmented control is visible but not wired to any CSS/write analog.**
   - Source: `src/app/(dev)/react-figma/page.tsx:398-418` defines `AutoFlowGroup` as an onChange-only segmented control.
   - Source: `src/app/(dev)/react-figma/page.tsx:2312-2316` renders Flow as `<AutoFlowGroup value={autoFlow} onChange={setAutoFlow} />`, so it only mutates local React state.
   - Contrast: `src/app/(dev)/react-figma/page.tsx:1755-1757` already supports `flexWrap` and `flexDirection` in `applyOverride`, and `src/app/(dev)/react-figma/page.tsx:848-869` wires the settings popover to `flexDirection`.
   - Live Chrome probe after `canvas wired` and selecting a real iframe element: clicking main `Horizontal` Flow produced `sheetAfterFlow: ""` and `overrideLogsAfterFlow: 0`; clicking adjacent `Wrap` immediately produced `sheetAfterWrap: "[data-eng-id=\"sel-1783193283682\"] { flex-wrap: wrap !important; }\n"` and `overrideLogsAfterWrap: 1`.
   - Impact: at least one visible inspector control does not stage or write a real CSS analog, so E3 cannot claim 29/29.

2. **MED — Text source writes lack visible toast feedback.**
   - Source: `src/app/(dev)/react-figma/page.tsx:1993-1996` posts `set-jsx-text`, then logs `"[engine] text commit"` / warns on catch; it never calls `notify()`.
   - Contrast: structural/create/save handlers call `notify()` at `src/app/(dev)/react-figma/page.tsx:1802`, `1837`, `1842`, `1852-1854`, `1863-1865`, and `1952-1953`.
   - Impact: "toast feedback" is not complete for all current source-writing UI paths.

3. **MED — Section-level "Apply styles and variables" buttons are local-only pickers.**
   - Source: `src/app/(dev)/react-figma/page.tsx:297-356` keeps `selected` in component state; option click only `setSelected(row); setOpen(false)`.
   - Source: those controls are exposed on Fill/Stroke/Effects at `src/app/(dev)/react-figma/page.tsx:2405`, `2414`, and `2433`.
   - Impact: visible controls titled "Apply styles and variables" do not bind a token/style or call `applyOverride`; field-level variable pickers do, but these section-level controls are still fake.

### Passed Gates

- **Write safety:** live API probes passed and restored clean. F1 gradient alias inserted `backgroundColor: '#123456'` while preserving the dynamic `background: \`linear-gradient(...)\``; text-container insert returned 422; invalid structural insert returned 422; local-scope make-component returned 422; stale JSX literal returned 409; duplicate/delete leaf splices returned 200 with parse-valid diffs; duplicate/delete returned root refused 422; `.ts` JSX write and `next.config.ts` CSS write returned 403; `.svg` upload returned 422.
- **No source pollution:** `git status --short -- src/ storybook/ public/uploads/react-figma` was empty before and after probes. Live dev SSR still carries in-memory `data-src` as expected: `/react-figma` 441 occurrences, `/react-figma/canvas` 109 occurrences.
- **Prod purity:** `npm run build` (`next build --webpack`) exited 0. `rg 'data-src=' .next/static .next/server` returned no matches. Broad `.next` matches only stale dev logs under `.next/dev/logs`, not prod artifacts.
- **DS traceability:** `/api/dev/editor-tokens` returned `837` tokens, `220` dark overrides, `837/837` structural path coverage, `313` color / `358` dimension / `166` other; Variables screen showed `ONEMO DS · 837 tokens` and columns `Name`, `CSS variable`, `Light`, `Dark`.
- **Layout guides:** system Chrome smoke clicked Add layout guide + Layout guide settings; `/api/dev/editor-write` delta stayed `0`.
- **Toast + SSR smoke:** system Chrome smoke saw visible toast `Select an element first`, no page errors, and no `document is not defined`; HTTP SSR for `/react-figma` and `/react-figma/canvas` also contained no `document is not defined`.

### Browser Harness Notes

Playwright's bundled Chromium cache was missing, so the browser smoke used installed system Chrome via
`channel: 'chrome'`. Temporary harness files lived under `/tmp/s58-e3-*.js`; no repo files were
created for the browser harness.
