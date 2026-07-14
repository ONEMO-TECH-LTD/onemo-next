# s58 react-figma E4 / KAI-9338 QA Review

Target: `onemo-next/.claude/worktrees/s58-figma-engine`  
Branch: `session58-task/react-figma-engine`  
HEAD audited: `0d61348`  
Route: `http://localhost:3025/react-figma`  
Verdict: **FAIL-with-findings**

## Findings

1. **HIGH — Add Fill / Add Stroke / Add Effect are dead on real live selections.**
   Evidence: live Playwright probe selected `storybook/prototypes/create-studio/Editor402.tsx:127:9` and clicked the inspector `Add fill`, `Add stroke fill`, and `Add effect` controls. The iframe staging sheet did not change for any of the three: `fillChanged:false`, `strokeChanged:false`, `effectChanged:false`.
   Source cause: `src/app/(dev)/react-figma/page.tsx:2587`, `:2596`, and `:2615` append to local `fills/strokes/effects`, but live selections render the `liveFills/liveStrokes/liveEffects` branches at `:2588`, `:2597`, and `:2616`; local additions are ignored, so the control has no real CSS analog and no visible row.

2. **MED — Assets insert-component path is not click-through verifiable in the clean tree.**
   Evidence: `/api/dev/editor-components` returned `{count:0, components:[]}` and `find src/app/(dev)/react-figma-components` returned no directory. The Assets panel therefore renders only the empty state at `src/app/(dev)/react-figma/page.tsx:2359-2360`, while the insert buttons only exist when `dsComponents.map` runs at `:2363-2365`.
   Server-side injection fix passes: invalid `importPath` and invalid component `name` both returned `422` from `src/app/api/dev/editor/lib.ts:605-610`. But the requested UI surface "Assets -> insert-component" has no insertable component in the frozen clean tree.

## Passing Evidence

- Frozen target: `git rev-parse --short HEAD` -> `0d61348`.
- Source cleanliness: `git status --short -- src/ storybook/ editor-engine/ next.config.ts package.json` -> `0` lines. General status only had untracked Playwright `test-results/`.
- Head move check: `git diff --name-only 82305be..0d61348` -> only `src/app/api/dev/editor/lib.ts`; `page.tsx` byte-equivalent across the head move.
- Route health: `fetch http://localhost:3025/react-figma` -> `200`.
- Live canvas: iframe had `109` `data-src` nodes, no browser page errors. Console only React DevTools/HMR/engine wiring logs.
- Production purity: `npm run build` exit `0`; `npm run typecheck` exit `0` after build regenerated `.next/types`; `rg 'data-src=' .next/static` exit `1` / no matches.
- Initial pre-build `npm run typecheck` failed because stale `.next/types` referenced missing generated files; build regenerated them and the rerun passed.
- Tokens: `/api/dev/editor-tokens` -> `837` tokens, `220` dark overrides, `0` missing structural paths; first row `--prim-col-base-white`, Light `oklch(100% 0 0)`, Dark `oklch(0% 0 0)`.
- SVG upload safety: `/api/dev/editor-image` with `qa.svg` -> `422 unsupported image type ".svg"`; source allowlist excludes `.svg` at `src/app/api/dev/editor-image/route.ts:13-15`.
- Structural write safety negative probes: invalid component import path -> `422`; invalid component name -> `422`; insert into text-bearing `Editor402.tsx:120:11` -> `422`; write to `next.config.ts` -> `403`.

## Live Matrix Notes

- Flow fix: selecting real container `Editor402.tsx:135:9`, Flow Horizontal -> `display:flex`, `flex-direction:row`; Vertical -> column; Grid -> `display:grid`; Freeform -> `display:block`.
- Distribute fix: Position Distribute -> Space between staged `justify-content:space-between`.
- Spacing/clip/appearance: Gap `20`, padding X `7`, padding Y `8`, Clip toggled to `overflow:hidden`, opacity `42` -> `0.42`, radius `11` -> `11px`.
- Align x6 fix: selecting `Editor402.tsx:159:15`, all six buttons stage the expected `margin-left/right/top/bottom` declarations. CSSOM resolves used margins to `0px` in that flex context, but the staging sheet contains the correct `auto` values.
- Code mode fix: selecting `Editor402.tsx:159:15` and toggling Code mode shows `storybook/prototypes/create-studio/Editor402.tsx:159` and the selected JSX line.
- Font picker fix: selecting text `Editor402.tsx:120:11`, picking Georgia stages `font-family: Georgia, "Times New Roman", serif`; font size `23` and weight `700` apply live.
- Type settings: Underline applies `text-decoration-line: underline`.
- Selection recolor fix: selecting `Editor402.tsx:117:7` and editing a Selection color changes the staging sheet.
- Style apply fix: selecting filled node `Editor402.tsx:108:9`, Fill style picker binds a real token and stages `background-color: var(--prim-col-base-white) !important`.
- Variables screen: Name / CSS variable / Light / Dark columns visible and backed by live token API.
- Layout guide: treated as honest no-source local guide surface.

## Deslop / Source Read

- Full implementation read included `src/app/(dev)/react-figma/page.tsx`, `engine.ts`, `canvas/page.tsx`, dev API routes, `editor-engine/tagging-loader.cjs`, `next.config.ts`, and `package.json`.
- Deslop scan found no active mock constants in implementation. `INHERITABLE`, `layerLabel`, and `splitSlots` remain internal helpers in `engine.ts`, not exported.
- `queryLocalFonts` appears only inside the Font picker with graceful unsupported/denied toasts.
