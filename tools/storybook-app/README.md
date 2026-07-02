# ONEMO Storybook — launcher

Click **`ONEMO Storybook.app`** (in `/Applications`) to boot the consolidated
Storybook (if it isn't already running) and open it in Chrome.

- **`launch-storybook.sh`** — the auto-launcher: starts `npm run storybook` on
  port 6017 in the consolidation worktree if it's down, waits, then opens Chrome.
- **`build-app.sh`** — rebuilds the clickable `.app` from the launcher script.

First launch: macOS may say the app is from an unidentified developer (it's
unsigned, built locally). Right-click the app → **Open** once to allow it.

Port `6017` and the worktree path are set in `launch-storybook.sh`.
