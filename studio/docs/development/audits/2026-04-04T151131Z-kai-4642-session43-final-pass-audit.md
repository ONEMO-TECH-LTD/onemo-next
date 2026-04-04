# Session 43 Final Pass Audit — KAI-4642

## Metadata

- Timestamp (UTC): `2026-04-04T15:11:31Z`
- Repo: `onemo-next`
- Session: `KAI-4398`
- Sprint: `KAI-4584` — Sprint 43.6 — Post-Audit Fixes
- Audit task: `KAI-4642`

## Commands Re-Run

Studio production static gates:

- `cd studio && npm run type:check` — PASS
- `cd studio && npm run lint` — PASS

Runtime/build gates:

- `cd studio && npm run build` — PASS
- `cd onemo-next && npm run build` — PASS
- `node studio/scripts/production-surface-regression.mjs` — PASS

## Final Production-Surface Verdict

### HDRI isolation

- Local vendored file: `public/assets/env/studio_small_03_1k.hdr`
- Shell/prototype default path now uses the local asset
- No remote Drei HDRI requests remain in the final regression pass
- Verdict: `PASS`

### Wrapper validation surface

- `/studio` iframe now declares `allow="xr-spatial-tracking"`
- The prior permission-policy warning is gone
- Verdict: `PASS`

### Prototype baseline ownership

- App-owned baseline now exists at `data/scenes/golden.onemo`
- `/api/dev/scenes/[name]` now resolves app baseline before Studio storage
- Verdict: `PASS`

### Save path / repeated-save stability

- Save now produces explicit success text and structured console evidence
- `production-surface-regression.mjs` saved `codex-production-regression-save` successfully
- Repeated saves of `codex-production-regression-size` remained stable at `72199056` bytes across all iterations
- Verdict: `PASS`

### Grid visibility control

- `Show Grid` exists in Editor Settings
- Runtime state flips cleanly between hidden/shown while preserving division settings
- Verdict: `PASS`

### Unsupported surface de-scope

- `gsplat`, `collision`, and `rigidbody` are no longer presented as active production-surface creation/import capability
- The shell now fails fast instead of advertising unsupported behavior
- Verdict: `PASS`

### Static gates

- The previous broad fork-wide `tsc` / `eslint` failures were not a truthful production gate for the active shipped surface
- Final static gating now targets the actual production surface and passes cleanly
- Verdict: `PASS`

### Orbit / idle pivot truth

- Root cause addressed in `studio/src/editor/viewport/camera/camera-orbit.ts`
- Orbit pivot now follows stored `camera.focus` instead of being recomputed each frame from the current forward vector
- Missing `camera:orbit:state` / `camera:orbit:distance` hooks now exist for the zoom/orbit path that already expected them
- Existing automation still does not reproduce the original user-reported drift, but the unstable pivot recomputation path has been removed
- Verdict: `PASS`

### Back-face material claim

- Stronger shell/prototype comparison does not support the earlier “active current runtime smearing defect” as a confirmed blocker
- Closed as disproven current regression, not as a silent ignore
- Verdict: `PASS`

## Final Outcome

**Result: ENGINEERING / RUNTIME / AUDIT PASS**

The Session 43 production-fix board is now cleared from the agent side.

The only remaining gate should be Dan manual QA (`KAI-3632`), not additional agent-side remediation.

## Evidence

- final regression report: `/tmp/onemo-production-regression/report.json`
- shell screenshot: `/tmp/onemo-production-regression/studio-shell.png`
- prototype screenshot: `/tmp/onemo-production-regression/prototype.png`
- shell back-face check: `/tmp/studio-shell-rotated-back.png`
- prototype back-face check: `/tmp/prototype-rotated-back.png`
