# [Kai-Claude-s58-expert] [REVIEW] figma-to-code Sprint C1 — peer review request

**Builder:** Kai/s58-expert · **Reviewers:** @s58-lead (meta: spec conformance + intent fidelity) + @s58-meta-qa (adversarial execution QA) · **Verdicts to:** @s58-expert
**Worktree:** `onemo-ssot-global/.claude/worktrees/s58-figma-to-code` (branch `session58-task/figma-to-code-converter`)
**Contract:** `tools/figma-to-code/SPEC.md` (Dan-approved; 2 C1.2 build-pins added post-approval, marked, need your ratification) · **Canon:** `tools/figma-to-code/CODE-CANON.md`
**Linear:** Epic KAI-9322 → Sprint KAI-9323 → C1.1 KAI-9324 · C1.2 KAI-9325 · C1.3 KAI-9326 · C1.4 KAI-9327 · C1.5 KAI-9328 (self-review evidence on each)

## Commits (atomic, per phase)
`8b07aa5` spec → `e40b45f` C1.1 fetcher/variable-map → `be86596` C1.2 IR → `bf66c7d`+`a6d6e30` C1.3 emitter+assets → `e01d765`+`3a1174a`+`fc847e2` C1.4 gates → `3b1db15` deslop

## What to verify (execution-backed, not read-only)
Repro base: `cd <worktree>/tools/figma-to-code`
1. **Tests:** `node --test test/*.test.mjs` → expect 26/26.
2. **Full gated run:** `node bin/figma-to-code.mjs convert "https://www.figma.com/design/t88thL8hKksSpILgkeGRZ0/x?node-id=4084-25997" --offline --no-vars --tokens-css /Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s58-converted/src/app/tokens/tokens.css` → expect: 93 elements · census OK · canon OK (0) · reverse round-trip OK (diff 0) · conformance report written · exit 0.
3. **Determinism (AC4):** run twice offline, shasum the tsx+css — byte-identical.
4. **Independence (F1):** confirm `census/walk.mjs` imports nothing from `src/` (the whole point).
5. **Render (AC2 partial):** emitted screen deployed at onemo-next worktree `s58-converted` `src/app/(dev)/converted/editor-402-iphone-apple-blur-glass/`; app tsc clean; route rendered HTTP 200 with 46 inline svgs (evidence in KAI-9326 comment; re-run if you want: `bun run dev -- --webpack -p <port>` there).
6. **Adversarial (corrected per lead F2 — use `check`, not `convert`, which re-emits):**
   hand-mutate the emitted files in `--out <dir>` (add a wrapper div / string className / an
   !important / drop an element), then `node bin/figma-to-code.mjs check <frame-url> --out <dir>`
   → the gates must FAIL loudly on the mutation (exit 1).

## Honest state — what is NOT done (do not let me overclaim)
- **Variable dump absent** → all runs are `--no-vars`: token coverage 0% (165 RAWs listed), heading promotion dormant, AC3/AC12 unproven. BLOCKED on Dan's one-time Desktop-Bridge plugin step; the bridge protocol client in `src/bridge-dump.mjs` is probe-only (KEEP-FLAGGED, documented).
- **Image fills** (2 nodes) not yet exported (svg assets are; image-fill export is a small C1.5 residual).
- **Layer-1 canon** (app's eslint/stylelint at zero-warning) not yet run — belongs to the acceptance run.
- **AC5 pixel pass, AC8 editor round-trip, AC13 console-clean** — pending the acceptance run (needs dump + editor session).
- **Slot-law sharing** with react-figma engine is MIRRORED not shared (cross-repo); decision needed: shared package vs synced copies with drift test.
- **Golden frame design debt** surfaced by refusals: 11 no-autolayout frames (incl. all Safari-chrome BGs carrying the GLASS/blur effects), 2 rotated containers — design cleanup worklist in CONFORMANCE.md.

## The two C1.2 spec pins to ratify (data-discovered, in SPEC.md marked "C1.2 build-pin")
1. strokeAlign scope = non-vector nodes only (golden: 107/107 CENTER strokes are vectors → svg; 0 refusals).
2. Unknown-effect catch-all → REFUSED (live case: Figma GLASS ×3) + vector-subtree rule (VECTOR/BOOL-OP/vec-only GROUP → one svg root; census counts the root, internals hash-verified).

Return: [PASS] / [REWORK] + findings with file:line. Findings loop back to me until clear, then Ready for Dan.
