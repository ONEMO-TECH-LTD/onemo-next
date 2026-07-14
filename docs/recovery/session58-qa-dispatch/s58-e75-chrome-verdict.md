# E7.5 chrome — scoped write-safety review — s58-lead verdict

Reviewer: Kai (s58-lead). Requested by @s58-designer. Branch `session58-task/react-figma-e75-components-canvas`
@ `6fb2730` (base `0bca3d3`). Scoped ask: write-safety lens, 3 questions. tsc run against the REAL
`6fb2730` (throwaway worktree, shared node_modules, removed after — frozen trees untouched). @s58-qa
runs the live gate. Last E7 review before designer meta + merge.

## Verdict: **PASS** — client-only, no new write surface, suppress is correctly scoped, tsc 0.

### Q3 · Server-surface drift — ZERO (verified first)
`git diff --name-only 0bca3d3..6fb2730` = exactly two client files (components-canvas/page.tsx,
page.tsx). No `src/app/api/**`, no `route.ts`, no `editor-engine/`, no `next.config.ts`. Every jail /
`resolveEditorPath` / sandbox surface I PASS-locked at 0bca3d3 is byte-untouched. The one new client
call — components-canvas `fetch('/api/dev/editor-components')` — is a READ of an existing dev-only,
read-only, already-locked GET route (inventory for gallery grouping). No write.

### Q1 · Rail row-click → `data-component-source` targeting — selection-only, no write-path
The change makes `onJump` pick, among a frame's `[data-src]` descendants, the one whose data-src
`startsWith(source + ':')` (falling back to `tagged[0]`), then dispatches a bubbling synthetic click.
Write-safety trace:
- `data-component-source` is used **purely to choose which already-tagged element to click** — a
  client-side match string. Grepped every `editor-write` POST in page.tsx (14 call sites): all send
  `sel.file`/`m[1]` (the element's own `data-src` identity), **none send `data-component-source`**.
- The synthetic click feeds the SAME existing selection path (`applySelection` → `sel`), which is what
  drives applyOverride/publish — all already gated by the locked server jails. Write identity still
  comes from the real `data-src` (loader-stamped, package-prefixed/repo-relative stable id), which
  flows through `resolveEditorPath` on any subsequent write.
- Net effect is a **precision improvement**: selects the component's own root element instead of an
  arbitrary first descendant. Selecting a global component's element and editing it still writes to
  the package via the already-verified resolver — the intended, locked global-edit path, not a new
  one. **No new write surface, no identity spoofing, no escalation.**

### Q2 · `suppressHydrationWarning` on the components-canvas root — ACCEPTABLE scoped mitigation (my call)
Verified against real `6fb2730`: **exactly one occurrence**, on the root `<div data-components-canvas>`
(line 129) — not on any frame/figure/component element.
- React's `suppressHydrationWarning` is **one-level**: it silences only the element's own attributes
  and direct text, and **does NOT recurse to descendants**. So it suppresses exactly the known
  root-level `data-eng-id` race (the engine stamps `data-eng-id` at runtime = expected SSR/client
  divergence on the host root) and would **still warn on any real per-frame or per-component hydration
  mismatch** — the meaningful subtree stays unmasked.
- The gallery subtree is already mount-gated (`frames=[]` until the mount effect), so SSR and the
  hydration pass both render an empty root — the frames themselves don't drive a mismatch. The
  suppression targets the residual root attribute race, nothing more.
- Route is dev-only (whole react-figma editor); warnings never reach production.
- **My judgment (per your "your call stands"): accept it.** It's the minimal honest acknowledgment of
  a benign, expected root-attribute divergence — not a subtree-wide mask. **Guardrail:** it must stay
  root-only; the moment `suppressHydrationWarning` appears on a frame/component element it starts
  hiding real per-component hydration bugs. It's root-only here — good. If a future change needs it
  deeper, that's a re-review trigger, not a copy-paste.

### tsc
`npx tsc --noEmit` against the actual `6fb2730` content → **exit 0, zero errors** (the new `Root` /
`InventoryEntry` / `Frame` / `ComponentGroup` types + `groupFrames`/`fallbackGroups` typecheck clean).

## Bottom line
E7.5 is chrome + a smarter selection target + an SSR-race silence — all client, all inside the
already-locked write model. The rail-click drives selection only (write identity still the real
`data-src` through the locked resolver), `data-component-source` never reaches a write, and the
`suppressHydrationWarning` is correctly one-level on the root (masks the benign engine `data-eng-id`
race, not descendant mismatches). Server surfaces byte-untouched, tsc 0. **PASS** on my write-safety
lens — clear for your meta review + merge once Codex's live gate concludes.
