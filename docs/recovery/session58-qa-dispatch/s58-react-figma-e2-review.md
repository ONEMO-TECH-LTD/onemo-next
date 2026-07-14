# react-figma Sprint E2 — Adversarial Peer Review (team lead gate, Codex QA quota-down)

Reviewer: Kai (s58-lead). Requested by s58-designer 2026-07-04.
Scope: E2.1–E2.5 at HEAD `3804a89` **plus** `77e2bff` (set-jsx-text, landed mid-review — included).
Worktree: `onemo-next/.claude/worktrees/s58-figma-engine`, dev server :3025.
Method: EXECUTED, not eyeballed — read `lib.ts` in full (347→380 lines), the page.tsx write
dispatch + render paths, then ran adversarial probes against the live editor-write API with a
scratch TSX (created/probed/removed, tree left clean). `tsc --noEmit` exit 0 at `77e2bff`.

## Execution-verified GOOD (fair credit first)
- ✅ CSS write path unchanged from E1.4 (QA-passed) — 409 byte-guard, jail, bottom-up ordering all intact.
- ✅ `set-jsx-text` (77e2bff) has the right discipline: client sends `expectRaw`, server refuses
  JSX-reserved chars (`{ } < >`) over corrupting, single-text-child v1 cut, whitespace-preserving splice.
- ✅ X/Y writes correctly gated to positioned elements (page.tsx:1533-1535); resize modes deliberately
  read-only — claim verified true.
- ✅ Outer jail boundary holds: write to `next.config.ts` → 403 (probe).
- ✅ Numeric-literal preservation in JSX styles (`width: 100` + "200px" → `200`, stays a number) — probed live.
- ✅ Commits match claims; tree clean; dblclick inline text edit is Figma-canon.

## Findings (ranked, all execution-backed)

### F1 · HIGH · lib.ts `setJsxStyle` — silently clobbers dynamic expressions
Any non-literal style value is replaced with a static literal, no refusal. **Probe:**
`style={{ height: dyn }}` + write height=50px → `200 OK`, source became `height: '50px'` —
a live variable binding destroyed, invisible to the user (panel shows computed values; they
can't know a binding was there). This is the exact Onlook slop-class the engine was built
against, and it violates the engine's own refuse-over-guess law (the CSS path refuses on
raws-mismatch; set-jsx-text refuses reserved chars; this path guesses).
**Fix:** refuse 422 unless the existing initializer is `NumericLiteral`/`StringLiteral` —
expression-valued props are later scope, same cut as text's expression-child refusal.

### F2 · HIGH · the JSX style write is unguarded in practice
Two halves: (a) server guard is optional (`expectRaw?`) and the ONLY client never sends it
(page.tsx:1614) — **probed: unguarded replace succeeds 200 with no expectRaw**; (b) TOCTOU —
even when expectRaw is present, it is checked against the FIRST read (`source`) while the
splice is applied to a RE-READ buffer (`buf`); the CSS path verifies bytes against the same
buffer it splices, the JSX path does not.
**Fix:** client always sends expectRaw (it has the current value from the read pass); server
requires it for replacements; verify against the same bytes being spliced. ~5 lines total.

### F3 · MED · JSX write surface = every `.ts`/`.tsx` under src/ + storybook/, gated by a READ jail
`jailComponent` was designed as the read jail (its error text literally says "outside read
jail" — returned on a WRITE, probe 1a) and admits any `.ts`/`.tsx` under both roots: probe 1b
targeted `src/app/api/dev/editor/lib.ts` itself and PASSED the jail (saved only by "no JSX
element at 1:1"). Contrast: CSS writes are jailed to `*.module.css`.
**Fix:** dedicated write jail for JSX ops — `.tsx` only, correct error text; consider
restricting to currently-served scene files.

### F4 · MED · pre-selection fake values; Layout guide always mock
Before any selection, Stroke/Effects/Selection-colors render MOCK rows (page.tsx:2039/2049/2054
null-fallbacks); Layout guide renders mock rows ALWAYS (2057) with functional-looking add/remove
buttons that mutate mock state. The E2.1 empty-state law holds only after first selection —
a fresh load shows invented values presented as real. Honest ⚠️ comment exists (1319), but the
render doesn't distinguish.
**Fix:** default live states to `[]` (Figma empty sections) pre-selection; hide or visibly
mark Layout guide until wired.

### F5 · LOW · `setJsxText` shares F2's TOCTOU half
expectRaw is sent ✓ but verified against the first-read source, spliced into a re-read buffer.
Same one-line fix as F2(b).

### F6 · LOW · duplicate style keys
`.find` replaces the FIRST matching property; JS runtime honors the LAST. Lint catches dupes
in practice — note only.

## Answers to the three asked focuses
1. **set-jsx-style correctness/safety:** mechanism (AST position match, byte conversion,
   numeric preservation, insertion indent) is correct — F1/F2/F3 are the safety gaps, all probed.
2. **field→CSS map:** no wrong mappings found; X/Y positioned-guard and read-only resize verified
   as claimed.
3. **fake-value leaks:** F4 (pre-selection + Layout guide) — the one place Dan's law still leaks.

## Brainstorm answer — E2.5 option A vs B (architectural take, Dan's call)
**B — and it isn't actually a Figma deviation.** Figma's own bound field shows a NAMED pill
(the variable name in a chip), not an invisible bound state — so B is arguably MORE canon than A.
Decisive architecture reasons: (1) Dan's stated control model is "control through seeing" —
raw values legal but visible at a glance; A hides exactly that signal. (2) The converter spec's
RAW remediation loop (§3.4, now at Dan's gate) assumes the editor renders token-vs-raw visibly
different — A would break that loop's UX contract. (3) Dan said non-conformance disappears
because "i will see it and fix manually" — B is the seeing. Recommend B to Dan with the Figma
pill treatment extracted from their console as the visual.

## Verdict: REWORK-with-findings
F1 + F2 must land before this branch reaches Dan sign-off — both are small (one function in
lib.ts + one client line) and both violate the engine's own core law, proven by live probes.
F3/F4 in the same pass. F5/F6 notes. Everything else — including the mid-review set-jsx-text —
is strong, disciplined work consistent with E1's quality. Re-route to me for closure after fixes.

---

## CLOSURE RE-AUDIT — 2026-07-04 (s58-lead) · HEAD 4a9782b

Re-probed LIVE on :3025 (fresh scratch TSX, removed after; tree clean; tsc exit 0):

| Finding | Evidence | Verdict |
|---|---|---|
| F1 expression clobber | `height: dyn` + write → **422** "would destroy a binding"; literal width → 200, `height: dyn` untouched in source after probes | ✅ CLOSED |
| F2+F5 TOCTOU | diff verified: both JSX ops parse AND splice ONE buffer (`buf.toString` → same `buf` spliced); re-read calls removed | ✅ CLOSED |
| F3 write jail | `set-jsx-text` → `lib.ts` → **403** "outside JSX write jail (.tsx only)" | ✅ CLOSED |
| F4 fake values | `MOCK.` referenced NOWHERE (0 grep hits); fills/strokes/effects/layoutGuides default `[]`; selColors renders `liveSelColors ?? []` | ✅ CLOSED |
| F6 duplicate keys | `margin` ×2 + write → **422** "duplicate style key — ambiguous" | ✅ CLOSED |

**On the style-op expectRaw waiver (designer's flag):** ACCEPTED. F1 (literal-only) + the
single-buffer splice eliminate the corruption class; the client genuinely cannot reconstruct
raw literal text from computed styles. What remains is last-writer-wins on concurrent edits
of the same literal — a semantic, not a safety hole. **Condition (non-blocking): document it
as a one-liner in ENGINE-PLAN's hard-case table** so it's a recorded decision, not an accident.

Also noted: E2.5 landed with Dan's direct pick (option A + header Save) — Dan's call stands;
B rationale on record.

## VERDICT: PASS — Sprint E2 (E2.1–E2.5 + rework) is clear at my gate. Goes to Dan.
