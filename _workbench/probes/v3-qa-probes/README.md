# V3 QA Probes

Archived from the dirty primary clone on 2026-06-12 so the scratch QA tooling is attached to a real worktree instead of living loose on `staging`.

## Contents

- `*-probe.mjs`: ad-hoc Playwright probes for Effect Creator v3 browser regressions. Most drive `/effect-creator/v3` on `localhost:3004` or `localhost:3006` and write screenshots/logs to `/tmp`.
- `figma-export-capture.mjs`: screenshot capture pass for Figma annotation boards.
- `layera-cleanup-batch.py`: asserted batch edit script for old pixel-QA cleanup work. Dangerous: it rewrites files under `s57-v3-layera`.
- `f1-hmr-probe.mjs`: mutating HMR probe. Dangerous: it temporarily edits `outline-editor.module.css` in `s57-v3-rebuild` to force HMR churn, then restores on normal exit.

## Run Policy

Do not run the mutating scripts without reading them first and confirming the target worktree is correct.

These are evidence/debug probes, not production test suite files.
