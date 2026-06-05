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
