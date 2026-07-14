# QA — C8.1 Audit Console spine — @s58-meta-qa

**Routing note:** Dan explicitly routed this to @s58-meta-qa (it's a visual/UI operator surface, not the deterministic engine — the visual/design QA lane fits). Verdict to @s58-expert.

**Frozen HEAD:** `8450ec9` — worktree `onemo-ssot-global/.claude/worktrees/s58-figma-to-code`, branch `session58-task/figma-to-code-converter`, `tools/figma-to-code`. Delta commit only touches: `src/emit.mjs` (audit option), `bin/figma-to-code.mjs` (--audit flag), `audit/audit-export.mjs` (new), `audit/console.html` (new).

## What it is
The audit console spine — Dan's ask: click an element on the live screen → its box + dimensions annotated on the pixels → side panel shows Figma anatomy ↔ converted CSS with tokens resolved.

## Live surface
Running now: **http://localhost:3077/audit-console.html** (product screen editor-402). Click elements, hover previews, click selects. Right panel = the inspected node.

## Both halves mandatory (code + visual):

### Code
1. **Product build byte-identical** — `convert … 4084:25997` WITHOUT `--audit` must produce a TSX with **no `data-fc`** and be byte-identical to the pre-C8 product build (tag `c7-complete-pre-console-c0beb59`). Prove it.
2. **Audit build gated + stamped** — `convert … --audit` → census/canon/reverse/conformance all OK, and `grep -c data-fc` = element count (97). Reverse must pass with data-fc present (it's in the attribute group).
3. **Determinism** — two `--audit` converts diff-clean.
4. **audit-export** — `audit.json` per-node entries reconcile with `conformance.json` (coverage, drift, approximations) and `convert-run.json` (idMap).
5. `npm test` = 39/39.

### Visual (drive the console in a browser — Playwright/Chrome)
6. Click ≥5 element types (container, image card, inline svg icon, text, a dial). For each: the box lands on the right pixels with correct W×H, and the panel's `data-fc` + class + Figma anatomy + resolved tokens **match `audit.json`/`CONFORMANCE.md`** for that node.
7. Token resolution shown correctly: semantic `var(--…)` → resolved value (e.g. card `--sem-container-xxs → 20rem`; dial icon fluid `--com-controls-icon → clamp(…cqi…)` + C7.3 `color: var(--sem-col-fg-…) → oklch(…)`).
8. Chips top-right = summary (elements 97, coverage 76%, refusals 0, drift 0, approx 0).

## Known gaps to probe (I'm flagging, not hiding)
- **Drift/approximation flag rendering is coded but NOT live-exercised** — this screen is clean (0 drift, 0 approx). Verify the flag code path renders (e.g. point audit-export at a screen/synthetic with drift, or inspect the render() branch).
- No "deselect" (click empty space keeps last selection) — minor UX, intentional for the spine.
- Console reads a pre-generated `audit.json` copied to `public/audit/` — the deploy step is manual right now (not wired into convert); flag if that matters for the gate.

Verdict + any findings to @s58-expert.
