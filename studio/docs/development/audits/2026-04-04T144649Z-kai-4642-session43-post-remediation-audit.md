# Session 43 Post-Remediation Audit — KAI-4642

## Metadata

- Timestamp (UTC): `2026-04-04T14:46:49Z`
- Repo: `onemo-next`
- Session: `KAI-4398` — Session 43: Studio — Full Audit and Migration Audit
- Final fixes sprint: `KAI-4584` — Sprint 43.6 — Post-Audit Fixes
- Audit task: `KAI-4642` — Task 43.6.q — Run the final Codex post-remediation production-readiness audit against the full Session 43 contract

## What Was Re-Validated

Builds:

- `cd studio && npm run build` — PASS
- `cd onemo-next && npm run build` — PASS

Live browser/runtime validation:

- raw Studio shell on `http://127.0.0.1:3487/editor/scene/1`
- wrapped `/studio` route on `http://127.0.0.1:3005/studio`
- `/prototype` route on `http://127.0.0.1:3005/prototype`

Durable regression script:

- `studio/scripts/production-surface-regression.mjs`
- latest report: `/tmp/onemo-production-regression/report.json`

## Requirement -> Observed Behavior -> Verdict

### HDRI / network isolation

- Requirement: the default golden scene path must not fetch the remote Drei `studio` preset at runtime.
- Observed behavior:
  - shell requests local `http://127.0.0.1:3487/assets/env/studio_small_03_1k.hdr`
  - prototype requests local `http://127.0.0.1:3005/assets/env/studio_small_03_1k.hdr`
  - no `raw.githack.com` or `raw.githubusercontent.com` HDRI requests remain in the headed validation passes
  - golden scene JSON remains unchanged with `preset: "studio"`; the runtime now vendors that preset locally instead of mutating the scene contract
- Verdict: `PASS`

### Wrapper permission-policy hygiene

- Requirement: the wrapped `/studio` route must not emit the current `xr-spatial-tracking` permission-policy noise.
- Observed behavior:
  - iframe now declares `allow="xr-spatial-tracking"`
  - headed wrapper console no longer emits the prior permission-policy warning
- Verdict: `PASS`

### Prototype baseline route ownership

- Requirement: the prototype baseline must not depend on Studio scene storage precedence.
- Observed behavior:
  - `data/scenes/golden.onemo` now exists as an app-owned baseline copy
  - `/api/dev/scenes/[name]` now resolves app-owned `.onemo` / `.json` paths before Studio-owned ones
  - direct API proof returns the app-owned `golden.onemo` payload hash
- Verdict: `PASS`

### Save/export path clarity

- Requirement: the save path must be explicit enough for browser/runtime audit to verify.
- Observed behavior:
  - shell save now emits `status:text` confirmation
  - shell save now logs `[onemo:scene] saved` with the scene name and endpoint
  - live browser proof saved `codex-production-regression-save` through `/api/onemo/scenes`
  - the saved scene name persists in localStorage as `onemo.playcanvas.last-scene`
- Verdict: `PASS`

### Repeated-save `.onemo` growth

- Requirement: repeated saves of the same scene should not grow unboundedly.
- Observed behavior:
  - three consecutive saves of `codex-production-regression-size` produced identical file sizes:
    - `72199056`
    - `72199056`
    - `72199056`
- Verdict: `PASS`

### Grid visibility control

- Requirement: the current UI must expose a clear working grid visibility control.
- Observed behavior:
  - Editor Settings now exposes `Show Grid`
  - runtime state flips cleanly between `showGrid: false` and `showGrid: true`
  - grid visibility can now be controlled without mutating stored grid size values
- Verdict: `PASS`

### Deferred / fake component surfaces

- Requirement: unsupported deferred surfaces should not remain advertised as production-ready capability.
- Observed behavior:
  - `collision`, `rigidbody`, and `gsplat` were removed from the active supported-component creation surface
  - gsplat import/drop creation is no longer booted from the active editor entry
  - gsplat uploads now fail fast with explicit production-surface messaging
  - script/layout/UI fake surfaces were already largely de-scoped before this pass
- Verdict: `PASS`

### Back-face material smearing claim

- Requirement: do not carry a speculative visual-defect fix without stronger evidence.
- Observed behavior:
  - shell and prototype both render the same rotated back-face surface under the preserved golden scene
  - no shell/prototype divergence or broken-material corruption was found in the recheck
  - the observed horizontal suede lines appear consistent across both surfaces rather than as a runtime-specific defect
- Verdict: `DISPROVEN / CLOSE AS NO CURRENT RUNTIME REGRESSION`

### Static quality gates

- Requirement: the Studio should pass its own static quality gates cleanly enough to support a production-ready claim.
- Observed behavior:
  - `studio` build passes
  - app build passes
  - the previously flagged settings-panel Sass notation errors were fixed
  - `studio` typecheck still fails broadly across the legacy fork surface
  - `studio` lint still fails broadly across legacy/vendorized/editor-fork surfaces, far beyond the original settings-panel style failure
- Verdict: `FAIL`

### Viewport interaction after idle / trackpad-sensitive orbit truth

- Requirement: the production-ready claim should survive the reported idle-orbit / wrong-pivot concern with stronger evidence than mouse-only happy-path checks.
- Observed behavior:
  - previous automated mouse checks did not reproduce the orbit drift
  - this final pass did not gain new trackpad-specific evidence strong enough to close the report honestly
  - handle placement remains visually consistent in the currently exercised path, but the user-reported idle/trackpad concern is still not durably disproven
- Verdict: `FAIL / STILL REQUIRES MANUAL-QUALITY CLOSURE`

## Final Verdict

Session 43 is materially stronger than it was before this remediation pass.

What is now true:

- the golden/default HDRI path is local instead of remote
- the wrapper permission-policy error is gone
- the prototype baseline is explicitly app-owned
- save proof is explicit and durable
- repeated-save growth does not reproduce
- grid visibility control is now exposed and works
- unsupported deferred component creation/import surfaces were reduced
- the previously carried back-face-smearing claim does not survive stronger shell/prototype comparison as a confirmed runtime defect

What is not yet true:

- the Studio static gates are clean enough to support a no-reservations production-ready claim
- the user-reported idle/trackpad orbit concern is closed with durable proof

## Audit Conclusion

**Result: NOT READY FOR FINAL PRODUCTION SIGN-OFF YET**

The remediation pass successfully cleared several real production blockers, but the final no-trust audit still leaves two blocker classes open:

1. static quality gates (`KAI-4632`, `KAI-4633`)
2. unresolved manual-quality viewport interaction truth (`KAI-4639`)

Dan QA should not be presented as the final remaining gate until those are resolved or deliberately re-scoped with explicit acceptance.

## Evidence

- regression report: `/tmp/onemo-production-regression/report.json`
- shell screenshot: `/tmp/onemo-production-regression/studio-shell.png`
- prototype screenshot: `/tmp/onemo-production-regression/prototype.png`
- additional back-face check:
  - shell: `/tmp/studio-shell-rotated-back.png`
  - prototype: `/tmp/prototype-rotated-back.png`
