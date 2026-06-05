# ERRORS

## KAI-8318 Studio v2 preview asset collision

- What did not work: copying product assets into `studio-v2/dist/assets` while Vite also emitted bundled JS/CSS chunks into `dist/assets`.
- Symptom: `npm run preview` served HTML, then the browser failed on `/assets/index-*.js` with 404 because the copy step wiped Vite's generated asset directory.
- What worked: set Vite `build.assetsDir` to `studio-assets` and reserve `/assets/` for ONEMO product assets copied from `../public/assets`.
- Remember: when Studio v2 needs product `/assets/...` URLs in a Vite build, keep Vite's own chunk directory separate from the product asset route.
