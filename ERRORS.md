# ERRORS

## KAI-8318 Studio v2 preview asset collision

- What did not work: copying product assets into `studio-v2/dist/assets` while Vite also emitted bundled JS/CSS chunks into `dist/assets`.
- Symptom: `npm run preview` served HTML, then the browser failed on `/assets/index-*.js` with 404 because the copy step wiped Vite's generated asset directory.
- What worked: set Vite `build.assetsDir` to `studio-assets` and reserve `/assets/` for ONEMO product assets copied from `../public/assets`.
- Remember: when Studio v2 needs product `/assets/...` URLs in a Vite build, keep Vite's own chunk directory separate from the product asset route.

## S57 QA Playwright browser smoke

- What did not work: relying on Playwright's bundled Chromium in this machine and asserting sidebar panel readiness by searching `document.body.innerText` for spaced labels.
- Symptoms: bundled Chromium was missing from `~/Library/Caches/ms-playwright`; the editor selected the smoke mesh, but body text collapsed labels like `OBJECTGEOMETRYMATERIALSCRIPT`, so the text assertion failed.
- What worked: launch Playwright with local Google Chrome and assert sidebar readiness through DOM tabs/outliner state instead of raw body text.
- Remember: for Studio v2 QA on this Mac, use `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` unless the Playwright browser cache is installed.

## KAI-8320 prototype screenshot server setup

- What did not work: starting Next dev without `--webpack`, then reusing the same locked `.next/dev` server after discovering Supabase env placeholders were needed.
- Symptoms: Next 16 defaulted to Turbopack and rejected the repo webpack config; after restart, middleware failed because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were unset; a second server could not acquire `.next/dev/lock`.
- What worked: stop only the dev server started for the screenshot run, then restart with `--webpack` plus harmless local Supabase placeholder env vars.
- Remember: for `/prototype` screenshot verification in this worktree, run `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run dev -- --hostname 127.0.0.1 --port <port> --webpack`.

## S57 golden prototype verification server

- What did not work: validating source edits against the existing `127.0.0.1:3211` server and then starting a temporary dev server without checking port/Turbopack requirements.
- Symptoms: `3211` was a built `next-server` serving stale chunks; `3212` was already occupied; `next dev` on `3213` defaulted to Turbopack and rejected the repo webpack config.
- What worked: identify the serving process with `lsof`/`ps`, then use a separate dev port with `--webpack` and local Supabase placeholder envs before browser verification.
- Remember: rendered source-change checks for `/prototype?scene=golden` must not trust an existing `next-server`; either rebuild/restart it or use a fresh `next dev --webpack` port.

## S57 effect-creator node-bar Playwright re-drive

- What did not work: generic selectors during the editor re-drive, specifically `input[type=file][accept="image/*"]` in strict mode and `svg` after entering the editor.
- Symptoms: the page has both pre-upload and toolbar file inputs, and the editor page contains many icon SVGs plus the actual canvas SVG, so strict Playwright refused to pick one.
- What worked: select an explicit file input (`first()` or the intended visible control), then target the editor canvas via the CSS-module canvas class (`svg[class*="outline-editor_svg"]`) before double-tapping/selecting anchors.
- Remember: effect-creator v3 visual probes should use role/label selectors for buttons and CSS-module substrings for the actual editor canvas, never generic `svg`.

## S57 creator v5 live QA harness

- What did not work: waiting only for the Editor button after Magic, using Playwright visibility on transparent SVG hit paths, and clicking the SVG/path bbox center to all-select a stretched organic duck outline.
- Symptoms: the first run mixed standard-square and Magic duck state; transparent crop hit paths resolved as hidden; after stretch, the rotate handle did not appear because the click missed the filled outline and never set all-selected.
- What worked: wait for `button[aria-label="Magic"][aria-pressed="true"]`, derive crop-grip coordinates from SVG `getBoundingClientRect()`, and use DOM hit-testing (`document.elementFromPoint`) to find a screen point actually inside the outline path before checking the rotate handle.
- Remember: for organic creator shapes, bbox center can be empty background; all-select/rotate probes must click a real hit-tested outline point, not geometric bbox center.

## S57 KAI-9066 rotate harness SVG grip hit-box

- What did not work: using Playwright `locator.waitFor({ state: "visible" })` or raw `getBoundingClientRect()` on horizontal SVG `path[class*="gripHit"]` crop grips.
- Symptoms: the grip was attached and interactive, but Playwright marked it hidden; the DOM rect could be zero-height because SVG path geometry excludes the large stroke hit area.
- What worked: compute the grip center from SVG `getBBox()` plus `getScreenCTM()`, then expand the synthetic hit box by the path stroke width before driving `page.mouse`.
- Remember: SVG path hit areas in the creator editor can be stroke-only; Playwright visibility/layout boxes are not reliable for those gesture handles.

## S57 file-read batching with macOS `nl`

- What did not work: passing multiple file paths to `nl -ba` during parallel source hydration.
- Symptoms: macOS `nl` returned usage text instead of file contents; three parallel read commands failed the same way.
- What worked: run `nl -ba` one file at a time, or use a shell loop only when explicit per-file headers are needed.
- Remember: for full-read hydration, do not batch multiple file operands into `nl`; one file per command keeps coverage auditable.

## S58 authoring semantic integration test contention

- What did not work: treating default 5-second and 10-second Vitest ceilings as stable evidence for TypeScript semantic-program plus durable-transaction integration cases during the full parallel suite.
- Symptoms: the exact same tests passed together in 3.64 seconds focused, but full-suite runs stopped at 5.003 or 10.003 seconds while other filesystem/compiler tests were contending; no assertion failed.
- What worked: retain the real integration coverage and give only the three multi-program/multi-transaction cases bounded 15-second or 20-second ceilings, then require the full suite to pass.
- Remember: do not use a focused green run to overrule a red full gate; distinguish contention with measured focused evidence, then make the full proof stable.

Follow-up at the committed authoring E2E gate: the local-`typeRoots` semantic case and source+graph+history undo case measured 1.32s and 1.72s alone, but crossed Vitest's 5s default under QA's cold parallel load. Both now use the same bounded 15s integration ceiling; assertions and suite parallelism remain unchanged.

## S58 component-shell Playwright setup

- What did not work: importing `@playwright/test` from a temporary test outside the repository, then launching the runner's bundled headless Chromium.
- Symptoms: the temporary test could not resolve the package until it used the installed global runner; after that, Playwright reported the cached `chromium_headless_shell-1208` executable was missing.
- What worked: keep the proof script outside committed source, use the installed global Playwright test package, and run the temporary config with `channel: 'chrome'` so it launches the Mac's existing Google Chrome.
- Remember: S58 browser proofs should use the system Chrome channel unless the Playwright browser cache is explicitly installed; do not install a second browser just for verification.

## S58 committed authoring E2E cold-start stability

- What did not work: using the 5-second default hydration poll, using `127.0.0.1` for the editor shell, assuming the Components panel switched immediately, and prewarming `/api/dev/editor-tokens` to hide cold-start request failures.
- Symptoms: the first run never hydrated because the dev-origin was rejected; later runs targeted a hidden component row; cold loads also launched about 30 token requests because the module cache had no shared in-flight promise, producing 404/aborted requests.
- What worked: use the configured `localhost` origin, prove each shell transition, deduplicate token loading in product code, and manage fixture/server teardown with a marker-backed wrapper that restores on startup failure or signal.
- Remember: committed S58 E2E must remain cold and fail on real console/network defects; environment setup must not prewarm product races away or rely only on test `afterAll` for cleanup.

## S58 inline-rename E2E interactions

- What did not work: clicking a nominally empty canvas coordinate that is covered by the fixed shell overlay, starting rename immediately before a delayed cold document replacement, and reading a frame through a text-filtered locator after its input value replaced that text.
- Symptoms: the click-away action was intercepted indefinitely, the first Enter edit was lost with the uncommitted label correctly unchanged, and the final attribute lookup waited on a locator that could no longer match.
- What worked: click a different visible variant for the blur-commit proof, retry the complete Enter transition across the known cold document replacement, and capture the stable `data-variant-id` before opening the input.
- Remember: S58 authoring E2E locators must follow stable identity across editable text changes; cold retries wrap a complete observable transition, never the semantic assertion alone.

Follow-up after the bounded import-reload protocol: the one permitted document replacement now completes before semantic commands begin, so Enter rename is single-shot again. Retrying it would mask a forbidden later reload and is no longer valid evidence.

## S58 import-bootstrap document identity proof

- What did not work: assuming Next would always reload after the sidecar import, polling `page.evaluate` as navigation destroyed the origin context, and calling `waitForLoadState` after the document request had already started (which returned the already-loaded origin document).
- Symptoms: the first run observed zero reloads and left the origin marker pending; the next two runs observed the one reload but the identity assertion raced the destroyed origin context.
- What worked: the successful import explicitly triggers its one contract-permitted reload, and the E2E subscribes to the next `domcontentloaded` event before clicking Import, then asserts the new document identity and exact request count.
- Remember: document-replacement proofs must arm the next-document event before the user action; a request event is earlier than navigation commit, and `waitForLoadState` is not a future-navigation subscription.

## S58 projection-fingerprint formatting probe

- What did not work: relying on TypeScript `Printer.printNode()` to canonicalize an original source node, then switching to a trivia-free scanner without first diffing every other normalized projection field; a shell `diff` pipeline subsequently closed stdout early and caused the diagnostic process to throw `EPIPE`.
- Symptoms: semantically identical inline union types still produced different projection hashes after the first two attempts, while the shell diagnostic obscured the actual remaining field difference.
- What worked: compare the two parsed projections recursively after applying the intended normalization and report exact differing property paths directly from one process.
- Remember: projection fingerprint debugging must compare normalized semantic payloads field-by-field; do not infer the remaining mismatch from the final SHA or pipe large JSON through early-closing shell consumers.

## S58 component-source HMR readiness

- What did not work: polling `require.context()` during HMR, then waiting for webpack's global `idle` status and requiring once. Both touched the old recursive context while it was already disposed and produced repeated `[HMR] unexpected require ... from disposed module` warnings.
- What worked: hot-accept the recursive component context itself, replace the context reference inside its accept callback, and keep the canvas busy until that exact context generation advances.
- Remember: webpack `idle` does not prove a disposed `require.context` reference is safe; readiness belongs to the context's own accept lifecycle.

## S58 cold authoring E2E readiness after ordinary reload

- What did not work: treating Playwright's generic `networkidle` as product readiness after the ordinary persistence reload, and dispatching keyboard undo without first proving the remounted authoring canvas was idle.
- Symptoms: one cold run exhausted the full 120-second test ceiling at `waitForLoadState('networkidle')` despite the document and resume-state assertions already passing; another cold run left geometry moved after `Meta+z` while the same exact build passed on rerun.
- What worked: wait for the exact one-successful-token-response-per-editor-document invariant already required by this test, and prove `data-authoring-busy=false` before dispatching undo.
- Remember: HMR/dev-server background traffic is not a readiness signal. Cold E2E synchronization must use explicit product state and exact request-count invariants.

## S58 extraction E2E route and reload isolation

- What did not work: registering the temporary selection route before the cold import probes, clicking its visible DOM before the live-layer bridge had wired it, assuming Next would reload after extraction, and installing the rewritten consumer before the new component dependency.
- Symptoms: route-manifest reloads reset the parent editor, the create action correctly refused a missing selection payload, the resume marker remained in the originating document, and Next briefly reported that the extracted component import could not resolve.
- What worked: create and compile the route after the cold probes, perform one explicitly unmeasured setup reload, wait for the matching live layer row, explicitly reload only after the durable transaction succeeds, and order source patches dependency-first (rollback already restores in reverse).
- Remember: separate harness route registration from the measured authoring reload; iframe visibility does not prove the editor selection bridge is ready; multi-file installs must expose dependencies before consumers and restore consumers before removing dependencies.

Follow-up: the remaining `waitForLoadState('networkidle')` after the create dialog later exhausted the full 120-second cold gate even though route, selection, and dialog state were ready. The harness now proves the `/authoring-e2e` iframe route, live selected layer row, visible create dialog, and one successful token response per current editor document before starting the measured create/reload window. The iframe-private `__engineWired` marker is deliberately not used here because the valid `onLoad` wiring path does not own that polling marker.

The final generic `networkidle` after bootstrap resume was removed in the same cleanup: resumed authoring canvas, exact resume phase/component identity, and successful token/document parity now gate that phase. Dev-server background traffic is no longer used as readiness anywhere in this E2E.

## S58 initial cold-shell authoring readiness

- What did not work: treating React hydration, a briefly visible Components search field, and a visible fixture row as proof that the initial editor document had finished its cold remount cycle.
- Symptoms: two isolated fresh-cache QA runs either remounted back to the File rail before the fixture interaction or began a new editor document navigation during the fixture double-click, exhausting the locator/test timeout.
- What worked: retry the complete idempotent rail-to-import-preview transition only after the current editor document has its matching successful token response and the current iframe document is complete and engine-wired; accept the attempt only when the preview appears without another editor document request.
- Remember: initial cold compilation can replace a hydrated shell. Synchronize against the current document's product signals and retry only the read-only transition; import/write semantics remain single-shot.

## S58 AC-X-004 headed pan proof

- What did not work: treating the first token/document parity as final cold-shell readiness, asserting that `nextjs-portal` itself must not exist, and running a shallow `/tmp` worktree without overriding the editor filesystem root.
- Symptoms: Fast Refresh replaced the document immediately after the first readiness check; after stabilizing that, the gesture passed but the test failed because Next mounts one empty dev portal during healthy operation; the shallow checkout then made the default depth-derived filesystem root jail healthy page/filesystem reads with 403.
- What worked: retry the complete idempotent atomic pointerdown→move→up proof until one document remains stable, retain accumulated console/page errors across attempts, assert the actual runtime-error copy is absent, and set `EDITOR_FS_ROOT` to the parent containing a shallow throwaway checkout.
- Remember: S58 headed crash proofs must distinguish product error UI from Next's always-mounted dev portal; cold retries may wrap only idempotent interactions and must never clear captured errors. Throwaway worktrees outside the normal `.codex/worktrees` depth need an explicit truthful `EDITOR_FS_ROOT`—never a weakened jail.

## S58 AC-X-002/001/003 real CSS-module path proof

- What did not work: asserting a dotted CSS filename through `toHaveProperty(path)`, then checking expected reload aborts against hardcoded port 3045 in an isolated run on another port.
- Symptoms: the exact CSS hash existed but the matcher parsed `.module.css` as nested path syntax; the complete create/reload flow then passed and failed only on the wrong expected origin.
- What worked: read the exact hash key directly and derive the expected origin from `PLAYWRIGHT_PORT`, matching `playwright.config.ts`.
- Remember: E2E filesystem identities with dots need direct-key assertions, and exact-SHA browser proof must remain portable across isolated ports.
