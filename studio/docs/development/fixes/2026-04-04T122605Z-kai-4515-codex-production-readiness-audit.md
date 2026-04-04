# Codex Production-Readiness Audit — KAI-4515

## Metadata

- Timestamp (UTC): `2026-04-04T12:26:05Z`
- Timestamp (Europe/London): `2026-04-04T13:26:05+0100`
- Repo: `onemo-next`
- Commit audited: `98694ac`
- Session: `KAI-4398` — Session 43: Studio — Full Audit and Migration Audit
- Sprint: `KAI-4515` — Sprint 43.3 — Pixel (Codex) Extensive Production-Readiness Validation
- Findings slice: `KAI-4585` — Task 43.6.a — Codex findings slice
- Mirror: `studio/docs/development/fixes/2026-04-04T122605Z-kai-4515-codex-production-readiness-audit.md`

## Scope

This is Codex's audit-only execution record for Session 43 Sprint 43.3. No remediation was performed inline while producing this report.

Validated surfaces:

- raw Studio shell: `http://127.0.0.1:3487/editor/scene/1`
- app-wrapped Studio route: `http://127.0.0.1:3005/studio`
- prototype route: `http://127.0.0.1:3005/prototype`

Evidence was captured through headed Chromium plus current build/test/static-check runs. Disposable screenshots and JSON summaries were kept under `/tmp/kai-4515/`.

## Source Contract Read In Full

Core contract docs:

- `studio/docs/north-star.md`
- `studio/docs/onemo-format.md`
- `studio/docs/pipeline.md`
- `studio/docs/architecture.md`
- `studio/docs/decisions.md`
- `studio/docs/development/audit-spec.md`
- `studio/docs/development/editor-feature-reference.md`
- `studio/docs/development/r3f-threejs-capabilities.md`

Historical/reference audit docs reread for comparison:

- `studio/docs/development/audit-findings-KAI-3839.md`
- `studio/docs/development/audit-findings-KAI-3840.md`
- `studio/docs/development/audit-fixes-KAI-3840.md`
- `studio/docs/development/bridge-gap-audit-2026-03-30.md`
- `studio/docs/development/bridge-report-KAI-3879.md`
- `studio/docs/development/pipeline-build-report.md`

## Contract Translation

The current Session 43 contract reduces to the following:

1. PlayCanvas is allowed as the Studio shell, not as rendering truth or scene-data truth.
2. R3F / Three is the real runtime and capability source.
3. `.onemo` is the round-trip scene truth between Studio and prototype.
4. No production-ready claim is valid without real-browser visual validation and click-through.
5. Audit work must file findings into Sprint 43.6 instead of patching them ad hoc.

## What Was Actually Run

Builds:

- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next/studio && npm run build`
- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next && npm run build`

Static checks:

- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next/studio && npm run type:check`
- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next/studio && npm run lint`
- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next/studio && npm test`
- `cd /Users/daniilsolopov/Dev/onemo-dev/onemo-next && npm test`

Runtime/browser checks:

- headed Chromium render capture for all 3 required surfaces
- shell selection + gizmo mode checks
- shell orbit behavior check, including a 70-second idle rerun
- runtime request inspection for external network dependencies
- golden-scene file hash comparison
- route precedence read for `src/app/api/dev/scenes/[name]/route.ts`

## Requirement -> Observed Behavior -> Verdict

### Required surfaces load

- Requirement: raw shell, wrapped `/studio`, and `/prototype` must load in a real browser.
- Observed behavior:
  - raw shell loads and renders the active Effect scene
  - wrapped `/studio` loads the shell inside the iframe
  - `/prototype` loads and renders the same active scene family
- Verdict: `WIRED`

Evidence:

- `/tmp/kai-4515/headed/studio-shell.png`
- `/tmp/kai-4515/headed/studio-wrapper.png`
- `/tmp/kai-4515/headed/prototype.png`

### Real-browser visual validation

- Requirement: no completion without real-browser visual validation and click-through.
- Observed behavior:
  - headed Chromium validation was completed against all required surfaces
  - shell selection and transform-gizmo states were exercised visually
- Verdict: `WIRED`

Evidence:

- `/tmp/kai-4515/interactions/01-selected.png`
- `/tmp/kai-4515/interactions/02-translate.png`
- `/tmp/kai-4515/interactions/03-rotate.png`
- `/tmp/kai-4515/interactions/04-scale.png`

### PlayCanvas shell vs R3F runtime truth

- Requirement: PlayCanvas may remain the shell, but hidden runtime truth must not contradict the R3F path.
- Observed behavior:
  - visible viewport behavior comes through the shared R3F viewer path
  - the active golden/default scene also routes environment defaults through the shared R3F `<Environment>` preset fallback
  - no new evidence in this pass showed PlayCanvas itself originating the remote HDRI dependency
- Verdict: `PARTIAL`

Why partial:

- shell usage is consistent with the north star
- some runtime defaults are still inherited through the prototype-side viewer contract in ways that remain production-sensitive

### Golden baseline drift

- Requirement: compare current Studio/current prototype baselines against backup golden scenes.
- Observed behavior:
  - `golden-scenes/studio/golden-scene.onemo`
  - `studio/data/scenes/golden.onemo`
  - `golden-scenes/user-prototype/golden-scene.onemo`
  - all have identical SHA-1: `4088ecb110a529cffc44b4a24629bf472d1805cf`
  - `golden-scenes/studio/golden-scene.json` and `golden-scenes/user-prototype/golden-scene.json` are also identical
- Verdict: `WIRED`

Conclusion:

- the tracked golden artifacts themselves are not drifting
- remaining problems point at runtime/default-path behavior rather than mutated baseline files

### Prototype scene route ownership

- Requirement: Studio -> prototype pipeline should preserve deterministic template truth.
- Observed behavior:
  - `src/app/api/dev/scenes/[name]/route.ts` resolves `[studioOnemoPath, appOnemoPath]`
  - prototype loads can therefore inherit Studio-owned scene files before app-owned ones
- Verdict: `MISSING`

This remains a production-readiness defect because the prototype baseline is still structurally coupled to Studio storage precedence.

### Grid toggle

- Requirement: the viewport should expose truthful controllable editing surfaces.
- Observed behavior:
  - the grid is visible in the shell
  - the visible settings/body text did not expose any clear grid on/off control in this pass
  - prior Session 43 findings about missing grid toggle remain consistent with the current run
- Verdict: `MISSING`

### Orbit behavior after idle

- Requirement: viewport interaction should remain trustworthy after idle time.
- Observed behavior:
  - a clean mouse-driven orbit rerun after a 70-second idle period stayed stable
  - no pivot drift was reproduced under mouse automation
  - this does not disprove a trackpad-specific bug
- Verdict: `PARTIAL`

Current interpretation:

- the previously filed issue remains valid as an unresolved manual/trackpad-sensitive report
- Codex did not reproduce it under mouse automation in this pass

Evidence:

- `/tmp/kai-4515/interactions/09-orbit-immediate-empty.png`
- `/tmp/kai-4515/interactions/10-orbit-after-idle-empty.png`

### Transform handle placement

- Requirement: handles should stay correctly positioned during interaction.
- Observed behavior:
  - selection and gizmos attach successfully
  - for `PRINT_SURFACE_FRONT`, the gizmo origin lands near the mesh origin rather than the visual center of the whole card face
- Verdict: `STUBBED`

Why stubbed:

- interaction exists and is not broken outright
- this pass did not establish enough contract evidence to promote the origin placement itself into a new confirmed fix issue
- the remaining coverage task stays tracked under `KAI-4595`

### Wrapper route hygiene

- Requirement: the wrapped `/studio` route should be a trustworthy validation surface.
- Observed behavior:
  - `/studio` still logs `Permissions policy violation: xr-spatial-tracking is not allowed in this document.`
- Verdict: `MISSING`

### Remote HDRI dependency

- Requirement: Studio validation/runtime should not depend on hidden remote assets when the contract expects local/offline behavior.
- Observed behavior:
  - both `studio/data/scenes/golden.onemo` and `golden-scenes/user-prototype/golden-scene.onemo` store:
    - `environment.file = null`
    - `environment.preset = "studio"`
  - `src/app/(dev)/prototype/core/onemo-loader.ts` maps that preset into the shared viewer config
  - `src/app/(dev)/prototype/core/EffectViewer.tsx` renders `<Environment preset={env.preset ?? 'studio'} ... />`
  - headed-browser requests from both raw shell and `/prototype` hit:
    - `https://raw.githack.com/pmndrs/drei-assets/.../studio_small_03_1k.hdr`
    - `https://raw.githubusercontent.com/pmndrs/drei-assets/.../studio_small_03_1k.hdr`
- Verdict: `MISSING`

Important clarification:

- this is not best described as a PlayCanvas-only dependency
- it is a golden/default scene plus shared R3F preset-fallback dependency
- the remediation path should decide whether the `studio` preset HDRI is intentionally the golden default and, if so, vendor it locally

### Back-face material truth

- Requirement: deeper visual audit should rule out or file mesh/material defects.
- Observed behavior:
  - the Effect back face still shows the previously tracked stretched/smeared suede-line look
- Verdict: `MISSING`

This remains filed as a real visual defect rather than a baseline drift problem.

### Static quality gates

- Requirement: Session 43 should not claim production-ready state while Studio static gates are red.
- Observed behavior:
  - `studio` build passes
  - app build passes
  - `studio` tests pass: `162`
  - app tests pass: `14` passing / `10` skipped
  - `studio` typecheck fails hard with a broad error set
  - `studio` lint fails on `sass/editor/_editor-settings-panel.scss`
- Verdict: `MISSING`

## Current Remediation Tasks Filed Under KAI-4585

Existing and still relevant:

- `KAI-4590` — Fix Codex finding — effect back-face material stretching / texture smearing in Studio and prototype
- `KAI-4591` — Fix Codex finding — default Studio/prototype environment path depends on remote Drei preset assets at runtime
- `KAI-4592` — Fix Codex finding — `/studio` wrapper iframe permission-policy errors in Chrome
- `KAI-4593` — Fix Codex finding — Studio grid plane cannot be switched off through the current UI
- `KAI-4594` — Fix Codex finding — Studio orbit pivot drifts after idle and resumes around the wrong center
- `KAI-4595` — Add interaction coverage for orbit pivot, dragging, and handle placement in Studio/prototype validation
- `KAI-4597` — Fix Codex finding — prototype scene API is coupled to Studio scene storage by route precedence

Newly filed from this pass:

- `KAI-4612` — Fix Codex finding — Studio typecheck is broken across adapter, viewport, and legacy UI surfaces
- `KAI-4613` — Fix Codex finding — Studio lint gate fails in editor settings panel styles

## Commands and Outcomes

Builds:

- `studio npm run build` -> `PASS`
- `onemo-next npm run build` -> `PASS`

Studio static gates:

- `studio npm run type:check` -> `FAIL`
- `studio npm run lint` -> `FAIL`
- `studio npm test` -> `PASS` (`162 passing`)

App tests:

- `onemo-next npm test` -> `PASS` (`14 passing`, `10 skipped`)

## Final Codex Verdict

Studio is **not production-ready** on the current Session 43 standard.

The decisive blockers from this pass are:

1. wrapper permission-policy errors remain on `/studio`
2. grid visibility is not clearly controllable through the current UI
3. prototype baseline still resolves through Studio-first route precedence
4. the active golden/default scene still depends on remote Drei preset HDRI fetching instead of a local explicit asset
5. the back-face material defect remains visible
6. Studio static gates are red (`type:check`, `lint`)

What this means:

- Session 43 audit truth remains separated correctly from remediation
- Sprint 43.6 now has the right Codex remediation queue for the currently confirmed defects
- the remote HDRI issue should be fixed as a golden-scene/shared-viewer default decision, not as a PlayCanvas-origin theory
