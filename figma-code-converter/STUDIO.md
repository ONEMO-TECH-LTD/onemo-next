# figma-to-code Studio — the conversion app

One deterministic block: paste a Figma frame link, get a converted, gate-checked, auditable
screen as a tab. No coding, no agents — the entire pipeline runs by itself.

## Launch from the Dock (the app)

**`Figma Converter.app`** is symlinked into **/Applications** — launch it from Spotlight/Launchpad,
or right-click its Dock icon while running → Options → Keep in Dock.

Every launch it asks **which converter folder to run from** (the main clone or any worktree),
remembering your last choice with a 5-second auto-continue — so the app is not tied to one
worktree and survives when a worktree is deleted. If a studio is already running for a different
checkout it restarts it on the one you picked. Then it ensures both servers and opens the studio
as its own chrome-less window. Failures show a macOS alert with the log path — never silent.

The remembered choice lives in `~/.figma-converter/root`. The /Applications entry is a symlink to
the bundle inside the checkout — after the converter merges to the main clone, re-point it:
`ln -sfn <main-clone>/figma-code-converter/launcher/FigmaConverter.app "/Applications/Figma Converter.app"`.

## How to use (the 60-second manual)

1. **Start the two servers** (the Dock app does this for you — manual path below) (each once, they keep running):
   - the Next dev app (renders the converted React): `npm run dev` in the app worktree (port 3077)
   - the studio: `npm run studio` in `figma-code-converter/` (port 3900) — the tool lives at the repo root of onemo-next
2. **Open `http://localhost:3900`** — the audit console with a browser-style tab strip on top.
3. **Convert:** copy a frame link in Figma (right-click frame → Copy link), paste it into the
   address line, press ⏎. The full pipeline runs (~20s): fetch → convert with every gate
   (census / canon / reverse / conformance) → audit data → fidelity captures. The screen opens
   as a new tab. A gate failure aborts and shows the gate's own words — nothing lands silently.
4. **Tabs:** click to switch screens. `×` deletes a sandbox screen. Re-converting the same frame
   overrides its tab (same slug). Every mode of the console (Inspect / Fidelity / Responsive /
   Theming / Structure) works per tab.
5. **Promote (`⇧`):** when a screen is accepted, promote it — a clean PRODUCT build (no audit
   stamps) is written to `src/app/(dev)/converted/<slug>/` in the app worktree, ready to commit.
   Sandbox conversions themselves are gitignored and never enter git.

The steps above are the operating **legacy** converter. Its Keep/Export routes remain available
until P9 cutover and Dan's sign-off. They do not create Compiler v2 evidence and cannot promote a
Compiler v2 candidate.

## Compiler v2 dual-run

The **Compiler v2** group is a truthful read/commit surface over an already-staged v2 sandbox:

- Legacy always remains visibly identified as the operating production lane.
- A v2 candidate shows its transaction state, evidence state, G0–G13 values, blockers, receipt,
  and exact package/report/registry hashes. Missing configuration has no invented terminal state.
- Studio can render only the sealed `runtime/index.html`, `runtime/bundle.css`, and
  `runtime/bundle.js` artifacts. The runtime iframe is script-enabled but origin-isolated.
- Studio can cancel a staged candidate or commit an externally signed, fully verified candidate
  to the **v2 sandbox pointer only**. It has no staging endpoint, private key, or signer.
- Legacy Keep/Export remains legacy-only. The v2 view labels its paste field accordingly.

Configuration is optional. With no `compilerV2` object, Studio remains usable and v2 reports
`promotion authority not configured`. To open an existing sandbox, add this to
`studio/config.json` (paths resolve from `studio/`):

```json
"compilerV2": {
  "rootDir": "../compiler-v2-store",
  "projectId": "onemo",
  "authorityId": "qa-meta-v1",
  "publicKeyFile": "../compiler-v2-authority.pub.pem"
}
```

Only those four fields are accepted. Private-key/signer fields refuse. `STUDIO_PORT=3901` may be
used for an isolated verification server without stopping the operating Studio.

## How it is built

```
studio/server.mjs   zero-dependency node server (port 3900)
  GET  /                      the audit console (freshest source, tabs enabled)
  GET  /api/screens           sandbox registry (scanned from disk — no database)
  POST /api/convert {url}     full pipeline → sandbox/<slug>  (override-safe)
  DELETE /api/screens/<slug>  delete a sandbox screen + its audit artifacts
  POST /api/promote/<slug>    product build → converted/<slug> (the dev/prod migration)
  GET  /api/compiler-v2/status
                              exact v2 sandbox/candidate truth beside legacy identity
  GET  /api/compiler-v2/runtime/<tx>/<index.html|bundle.css|bundle.js>
                              sealed, allowlisted runtime artifacts only
  POST /api/compiler-v2/commit/<tx>
                              signed verified candidate → v2 sandbox pointer only
  POST /api/compiler-v2/cancel/<tx>
                              cancel staged v2 candidate; legacy untouched
  everything else             proxied to the Next dev app (:3077) — ONE origin, so the
                              console can read the iframe document (inspection needs it)
studio/config.json  all paths/ports (app worktree, tokens.css, fonts dir, env file)
```

- **Sandbox location** — `src/app/(dev)/converted/sandbox/` inside the app worktree, gitignored.
  Why inside: converted output is React + CSS Modules; only the Next dev server can render it.
  Why gitignored: sandbox = scratch space; only promoted screens are committable.
- **Secrets** — `FIGMA_TOKEN` is read from the app's `.env.local` (config `envFile`); the studio
  introduces no new secret path.
- **Determinism** — the studio only shells out to the same CLI (`bin/figma-to-code.mjs`) and
  audit tools; same frame → byte-identical package. A stale variable dump refuses loudly with
  the refresh instruction (never mislabeled tokens).
- **Fidelity per tab** — Figma's own render (REST image export @2x) + a Playwright capture of
  the live route at the frame's exact size; the console's Fidelity mode diffs them per screen.

## Failure modes (all loud)

| Symptom | Meaning | Fix |
|---|---|---|
| "Next dev app not reachable" | the app on :3077 isn't running | start `npm run dev` in the app worktree |
| StaleDumpError in the convert alert | Figma file version moved past the variable dump | refresh the dump (bridge `dump-variables`), re-convert |
| Fidelity images missing on a fresh tab | captures still running (~10s after convert) | reopen Fidelity mode |
| Conversion alert shows a gate failure | the converter refused something real | read the gate's message — that is the finding |
