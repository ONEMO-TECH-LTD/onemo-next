# AC-A-008 Chief-QA Gate — Bounded PASS

**Date:** 2026-07-13  
**Chief QA:** `@s58-qa`  
**Row:** `AC-A-008` only  
**Verdict:** **PASS** for pre-Dan stamps `AC-J-005`, `AC-J-006`, `AC-J-007`; Meta `AC-J-008` and final Dan `AC-J-009` remain pending.

## Exact authority

- Product commit: `67cf91f2460e866f23a8e88880bfcf80270f78b6` (`fix(react-figma): match measured component breadcrumb`).
- Completion Contract v1.4: `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`, especially lines 20, 24, 26–30, 49–51, and 65–69.
- AC-3: `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`.
- Binding row: `AC-A-008` — “Home › Component navigation matches measured Framer semantics in Figma/ONEMO chrome.”
- Measured Framer target: `__qa-dispatch/s58-A008-breadcrumb-measurement-expert-2026-07-13.md`, SHA-256 `942c300310df9b6461cd769d0a5cfeb4b4fd05a557e056333e18d43ee231a97f`.
- Continuous gates applied: `AC-J-005/006/007`, plus styling laws `AC-J-013/014`.

## Source proof — AC-J-005 PASS

Exact diff: two files, `43` insertions and `5` deletions.

- `src/app/(dev)/react-figma/page.tsx:19-24` imports only the required Phosphor `File`, `Diamond`, and `CaretRight` icons.
- `src/app/(dev)/react-figma/page.tsx:4025-4028` removes the invented bordered/padded pill wrapper and text glyph separator.
- The fixed chrome is `12px` top/left, `30px` high, borderless, wrapper-padding-free, with `30px` chips, `0 10px` chip padding, `8px` radius, `12px/600` DS label type, `10px` separator gaps, and `12/10/12px` icons.
- Skin uses existing semantic tokens only: neutral Home, brand current-component, DS radius/type, and secondary separator. No raw Framer purple, raw color, `Inter`, or `system-ui` was added.
- Token chain is real: label-s → `--al-type-family-primary` → Chillax; radius-md → `--al-radii-md` → `8px`; semantic neutral/brand colors resolve through existing alias tokens.
- Home behavior remains `closeComponentAuthoring`; current-component behavior remains `selectFrameRoot`. No component-menu behavior was smuggled into this row.
- `tests/e2e/react-figma-authoring.spec.ts:154-194` adds exact computed-layout assertions to the existing same-component double-click/context-Edit proof. It also continues to assert the same file and stable `data-component-id` across both entries.
- Full source coverage is lineage-complete: the `4abe687a` parent page/test were read end-to-end in the preceding A003/A004 gate; the only intervening commits are A006 `94e69f7` and this A008 commit, and both exact diffs plus affected callers were read in full.

## Human-visible proof — AC-J-006 PASS

Isolated worktree:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a008-67cf91f`

Committed headed certificate on port `3088`: **1/1 PASS in 34.4s**.

```text
EDITOR_FS_ROOT=/Users/daniilsolopov/Dev/onemo-dev PLAYWRIGHT_PORT=3088 \
npx playwright test tests/e2e/react-figma-authoring.spec.ts \
  --grep 'opens the same existing project component from double-click and context-menu Edit' \
  --headed --workers=1 --reporter=line
```

Independent QA-instrumented headed runs on ports `3089` and `3090` passed in `24.4s` and `29.5s`. They additionally proved:

- accessible nav label `Component breadcrumb`, `aria-current="page"`, and all three decorative SVGs hidden;
- font family `Chillax`;
- Home `oklch(0.9827 0.0026 286.35)` / `oklch(0.5025 0.0136 264.44)`;
- current component `oklch(0.9638 0.0084 236.56)` / `oklch(0.5189 0.1112 238.81)`;
- separator rendered path fill `oklch(0.5025 0.0136 264.44)` from the secondary token;
- no Framer-purple value;
- identical breadcrumb bounding box after Zoom In, then Zoom Out;
- zero page errors and zero console errors.

Dan-openable visible artifact:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-worktrees/s58-chiefqa-a008-67cf91f/.playwright-cli/ac-a008-67cf91f-breadcrumb.png`

SHA-256: `114d16c01d6b65882241f19bcb814f7d7977a18aeb9071d2d90df91d60665eed`.

## Mutation proof

QA temporarily reverted only the measured nav gap from `10px` to the old `4px` and reran the headed certificate on port `3091`.

Observed result: **FAIL**. The assertion received separator gaps `[4, 4]` instead of `[10, 10]`. This proves the certificate detects the measured geometry rather than only the presence of a breadcrumb.

The mutation was reversed with `apply_patch`. Failure artifacts were moved reversibly to:

`/Users/daniilsolopov/Dev/onemo-dev/.codex-quarantine/s58-chiefqa-a008-mutation-2026-07-13/`

## Static and regression evidence

- `npm run typecheck`: PASS.
- Committed headed row certificate: PASS.
- `npx eslint tests/e2e/react-figma-authoring.spec.ts`: PASS.
- Whole `page.tsx` retains `12` inherited errors and `11` inherited warnings; zero diagnostic lands on an A008-changed line. No whole-page lint-clean claim is made.
- `git diff HEAD^ HEAD --check`: PASS.
- Product worktree returned clean after every temporary probe.
- Full Vitest under concurrent load: `53` passed files + `1` declared-skipped + `1` failed by timeout; `460` passed tests + `10` declared-skipped + `1` timeout. The timeout was the known unrelated V1 sidecar migration route test at its `20s` ceiling.
- Immediate focused rerun of that exact test: PASS in `4.219s` (`1` passed, `26` filtered/skipped). No product failure reproduced.

## `/o-deslop` judgment

- **KEEP:** the three direct Phosphor imports. Each is used once at the measured breadcrumb seam; no icon wrapper or invented SVG was added.
- **KEEP:** inline breadcrumb styles. This matches the existing monolithic page convention and avoids a one-use abstraction.
- **KEEP:** geometry assertions inside the existing entry-equivalence E2E. Reusing its expensive real component setup avoids a duplicate fixture while preserving A003/A004 identity regression coverage.
- The stale bordered wrapper, pill radius, 10px type, text separator, and bordered current-chip treatment were removed rather than layered over.
- No new TODO/FIXME/HACK, duplicate state owner, command, request path, menu behavior, or dead helper was introduced.

## Bounded verdict

**PASS — `AC-A-008` satisfies `AC-J-005`, `AC-J-006`, and `AC-J-007` at exact SHA `67cf91f2460e866f23a8e88880bfcf80270f78b6`.**

This does **not** stamp component-chip menu behavior, `AC-B-*`, `AC-B-022`, the blank-create shell, any broader P0 phase, Meta, or final completion.
