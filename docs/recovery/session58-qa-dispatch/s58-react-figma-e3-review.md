# react-figma Sprint E3 — Adversarial Peer Review (s58-lead)

Reviewer: Kai (s58-lead). Requested by s58-designer. HEAD `fc6d6b0`, worktree s58-figma-engine, :3025.
Method: EXECUTED — read the new ops in lib.ts, ran live adversarial probes against editor-write
(scratch TSX, removed after; tree clean), read the transform composer. tsc exit 0. Findings first.

## Execution-verified GOOD
- ✅ insert-jsx-child self-closing guard works: insert into `<img … />` → **422** "self-closing
  element cannot hold children" (probed).
- ✅ Transform composition (focus 3) CLEAN: `pushTransform` (page.tsx:1616) rebuilds the FULL
  transform from (rot, fh, fv) state every call — rotate+flipX+flipY compose, none clobbers another.
- ✅ E2 closure condition honored: last-writer-wins concurrent-literal semantic is now documented
  in ENGINE-PLAN.md:146 as I required.
- ✅ F1-F6 from E2 still hold (literal-only refuse, .tsx write jail, single-buffer) — regression-clean.

## Findings

### F1 · HIGH · background-color→background alias silently DESTROYS gradients/images (focus 2 — confirmed)
`isColorLiteral` (lib.ts:272) is `^(['"]).*(rgb|hsl|oklch)\(` — it matches any string that merely
CONTAINS `rgb(`, so a gradient counts as a "color" and gets clobbered.
**Probed live:** element `style={{ background: 'linear-gradient(90deg, rgb(0,0,0), rgb(255,255,255))' }}`
+ set background-color `#ff0000` → **200**, source became `background: '#ff0000'` — **the gradient is
gone.** Same regex fires on `background: 'url(...)'`-with-nothing or any `background: '…rgb(…)…'`
shorthand. This is silent, invisible data loss — the exact clobber class the engine's F1 (E2) was
built to prevent, reappearing one layer up. The glass screen's dome uses gradients — real exposure.
**Fix:** the alias may target `background` ONLY when the whole value is a bare color (anchor:
`^['"]?(#[0-9a-f]{3,8}|(rgb|hsl|oklch)a?\([^)]*\))['"]?$`), never when it wraps a gradient/url/
multi-layer value. When `background` holds a non-bare-color, insert `backgroundColor` as a new key
(or refuse) — never overwrite the shorthand.

### F2 · MED · insert-jsx-child into a TEXT-BEARING element is unguarded (focus 1 — the ask's own case)
Your ask says "insert into a text-only element … should 422." It doesn't. insertJsxChild (lib.ts:393)
guards ONLY self-closing (parent not a JsxElement); a text-bearing `<span>text</span>` IS a JsxElement
so it passes. **Probed:** insert `<div />` into `<span>text-only-node</span>` → **200**, produced
`<span>text-only-node  <div /></span>` — mixed text+element content, and a `<div>` inside `<span>`
is invalid HTML nesting (React hydration warning). setJsxText already has the exact detector you need.
**Fix:** before inserting, if the container has any non-whitespace JsxText child, refuse 422
(`container holds text — not an insert target`) — mirror setJsxText's `children.filter(ts.isJsxText)`.

## Focus 4 (controls that no-op) — scope-honest
I verified the write *mechanisms* (style/text/child/color-alias/transform) by live probe and found
the two above. I did NOT independently re-run all ~40 control self-audits — that's the parallel
adversarial pass (meta-qa/Codex at 18:38). My mechanism-level probes surfaced no dead handler in the
paths I exercised; the exhaustive control census I'm trusting from your per-control Chrome self-audits
(disclosed and credible), pending the adversarial sweep. Flagging the scope boundary rather than
claiming coverage I didn't run.

## Verdict: REWORK-with-findings
F1 must land before Ready-for-Dan — silent gradient/image destruction violates the engine's core
refuse-over-clobber law and hits the real glass screen. F2 in the same pass (small, detector already
exists). Both are ~5-line server fixes. Everything else — transform composition, self-closing guard,
the honestly-reverted effects redo, the E2 doc-note follow-through — is disciplined and clean.
Re-route to me for closure; meta-qa's parallel verdict stands independent.

---

## CLOSURE RE-AUDIT — 2026-07-04 (s58-lead) · working tree on HEAD 13b2997 (fixes uncommitted at probe time)

Re-probed LIVE on :3025 (dev server hot-reloads the working tree; scratch files removed, tree clean):

| Finding | Fix | Evidence | Verdict |
|---|---|---|---|
| F1 gradient clobber | `isColorLiteral` anchored `^...$` (lib.ts:276-279) — whole value must be a bare color, not a substring | gradient `linear-gradient(…rgb()…)` + set background-color #ff0000 → **200, gradient PRESERVED**, `backgroundColor` added as a separate key (not clobbered) | ✅ FIXED |
| F1 regression | alias path intact for real bare colors | isolated `background:'#000'` + set background-color → `background:'#ff0000'`, clean alias-update, no competing key | ✅ no regression |
| F2 text-container insert | `hasText` guard in insertJsxChild (lib.ts:403-405) mirroring setJsxText's detector | insert `<div/>` into `<span>text-only</span>` → **422** "container holds text content" | ✅ FIXED |

**Status: PASS pending commit.** All three verified working LIVE in the working tree, but the fixes
were uncommitted (HEAD still 13b2997) at probe time. Formal closure carries to the named HEAD once
the designer commits + re-routes — same delta-confirm pattern as the expert track. No re-fail; the
fixes are correct.

---

## LOCKED CLOSURE — 2026-07-04 (s58-lead) · committed HEAD 1bf38d2

Designer committed the rework: `1bf38d2` "E3 REWORK — F1 gradient-clobber + F2 text-container insert". Tree clean. Re-probed against the COMMITTED HEAD:

| Finding | @HEAD 1bf38d2 | Verdict |
|---|---|---|
| F1 gradient clobber | anchored `isColorLiteral` (lib.ts:276-279) committed; gradient + set background-color #ff0000 → 200, `linear-gradient(...)` PRESERVED, backgroundColor added as separate key | ✅ LOCKED |
| F2 text-container insert | `hasText` guard (lib.ts:403-404) committed; insert into `<span>txt</span>` → 422 "container holds text content" | ✅ LOCKED |
| Reviewed-files typecheck | 0 errors in engine.ts / page.tsx / lib.ts | ✅ clean |

**Non-blocking hygiene flag (not an E3 defect):** `tsc` reports 4 errors, ALL stale `.next/dev/types`
generated types for deleted scratch pages (`react-figma-pages/qa-probe-page`, `(dev)/qa-f1f2` — no
source exists; leftovers from create-page E3.5 test-runs). A `.next` clear removes them. Flagging for
the designer's next deslop — the create-page op should clean its scratch pages, or they accumulate.

## VERDICT: PASS — E3 closed at named HEAD 1bf38d2. Both findings locked, execution-verified.
