# E6 UI-conformance dispatch — @s58-engineer

**From:** @s58-designer (Kai) · **Report to:** @s58-designer ONLY (DM via kai-msg, prefix `[s58-engineer]`, tags [DONE]/[BLOCKED]/[QUESTION]). One recipient, never broadcast. You are a peer builder with your own Linear writes for these tasks. DM me BEFORE going idle.

## Scope — exactly two Linear tasks (KAI team)
1. **KAI-9356** — 2×2 grids for 4-input groups + remove the redundant Inset row + Publish disabled state per Figma.
2. **KAI-9361** — Assets panel: tabs by type (Components | Images | Icons), true thumbnails, no broken tiles.

Read both issue descriptions in Linear first — they carry Dan's verbatim requirements. Claim them (state → Building) before starting; set Ready for QA when done.

## Where
- Repo: `~/Dev/onemo-dev/onemo-next` — **create your own worktree + branch** off `session58-task/react-figma-engine`:
  `git -C ~/Dev/onemo-dev/onemo-next worktree add .claude/worktrees/s58-e6-ui session58-task/react-figma-e6-ui -b session58-task/react-figma-e6-ui origin/session58-task/react-figma-engine` (adjust if branch exists). NEVER commit to my branch or the primary clone.
- File: `src/app/(dev)/react-figma/page.tsx` (single-file editor UI). Engine: `engine.ts` (don't touch unless required).
- Live target: `http://localhost:3025/react-figma` runs MY worktree, not yours — for live verification either run your own dev server on a free port (`PORT=3026 npm run dev` in your worktree) or verify with Playwright against your own server. Do NOT restart or touch the :3025 server.

## Hard rules (Dan's, non-negotiable)
- **No vibe-coded UI.** Every visual decision comes from Figma's real UI spec. I extracted Figma UI3 input chrome from Dan's authenticated Figma tab (you cannot access Figma — your Playwright is unauthenticated). Measured specs:
  - Field container: **24px height, background rgb(245,245,245), border-radius 5px** (grouped segments split radius e.g. `5px 0 0 5px`), flex align-center, **no border** at rest; inner `<input>` transparent bg, 0 padding, color `rgba(0,0,0,0.898)`.
  - Table-style rows: 40px height, padding `0 8px 0 12px`.
  - If you need a spec I haven't supplied (e.g. Figma's disabled-button treatment, tab strip anatomy), **DM me [QUESTION] and I extract it from the live Figma tab — never invent.**
- **Icons:** Phosphor set `weight="light"` (already imported) or existing UI_ICON glyphs. Never unicode characters, never invented SVG paths.
- **Verification is real-input**: Playwright `mouse.down/move/up` + real clicks, not synthetic dispatchEvent (we shipped 2 HIGHs that passed synthetic and failed real input). Per fix: tsc 0, route 200 on your port, live probe evidence pasted in your report.
- **Zero source pollution**: only `page.tsx` (and engine.ts if unavoidable) change; `git status` clean otherwise; revert any probe writes.
- Commit per task with evidence in the message; **push your branch to origin after each task** (backup-push is a standing default). Do NOT merge anywhere.

## Task specifics
**KAI-9356:**
- 2×2: the individual padding T/R/B/L, corner ◜◝◞◟, and per-side stroke `SideInputs` groups render 2×2 (Figma's layout), not 4-inline. Component is `SideInputs` — change its grid to `1fr 1fr` and verify rows don't collide with section heights (they're in flow, should grow).
- Inset removal: delete the `Inset` InspectorRow (T/R/B/L inset fields) and its state/applyOverride cases ONLY if orphaned (`insetT/R/B/L` fields + `insetTop/Right/Bottom/Left` state); keep the `z-index` row (relabel/keep as its own CompactInspectorRow). X/Y stays — it covers position.
- Publish disabled: replace the `opacity 0.5` fade on the Publish button's disabled state with Figma's primary-button disabled treatment — DM me [QUESTION] for the extracted spec before styling (I'll measure it from Figma's Publish/Share button).

**KAI-9361:**
- Assets panel (`rail === 'assets'` block): add a Figma-style tab strip: **Components | Images | Icons**.
- Components tab = current dsComponents grid + New-component form. Images tab = canvasAssets.images. Icons tab = canvasAssets.icons.
- Fix broken thumbnails: image srcs from the canvas are iframe-relative — resolve against the canvas route origin (`new URL(src, location.origin)`), render as `object-fit: cover` `<img>` (not CSS background), icons rendered at glyph size centered on a neutral tile.

## Done =
Both tasks committed + pushed on your branch, states Ready for QA, and a [DONE] DM to me with: commit SHAs, per-task live-probe evidence, residuals named honestly. I review, then route to @s58-meta-qa. Dan signs off last — never mark Done yourself.
