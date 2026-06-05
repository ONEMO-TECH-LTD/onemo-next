# Studio v2 Verification - KAI-8320

Verdict: PASS.

Evidence was regenerated on 2026-06-05 against the committed Studio v2 branch. The prototype viewer was left unmodified: `src/app/(dev)/prototype/core/EffectModel.tsx` has an empty diff. The golden artwork was applied through the prototype's normal user path: Toolbar file input -> `page.tsx` `handleFile` -> `setArtworkUrl` -> `EffectViewer` -> `EffectModel`. The separate default-artwork-on-load product question is tracked outside this verification as KAI-8346.

## Golden Render Parity

Prototype command:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run dev -- --hostname 127.0.0.1 --port 3100 --webpack
```

Prototype capture browser: Google Chrome, headful, `--use-angle=metal`. This resolved the earlier headless WebGL-context telemetry issue without changing viewer code.

Studio capture app: `studio-v2/dist-electron/mac-arm64/Studio.app/Contents/MacOS/Studio`, recaptured after the latest `studio-v2 npm run build`.

| Scene | Prototype path | Studio `.onemo` path | Evidence |
| --- | --- | --- | --- |
| v0 raw | `/prototype?scene=golden` + Toolbar upload of `public/assets/test-artwork.png` | `/assets/templates/effect-70mm.onemo` | `verification/side-by-side-v0.png` |
| v1 Draco lossless | `/prototype?scene=golden-v1` + Toolbar upload of `public/assets/test-artwork.png` | `/assets/templates/golden-effect-70mm/v1-draco-lossless.onemo` | `verification/side-by-side-v1.png` |
| v2 Draco decimated smooth | `/prototype?scene=golden-v2` + Toolbar upload of `public/assets/test-artwork.png` | `/assets/templates/golden-effect-70mm/v2-draco-decimated-smooth.onemo` | `verification/side-by-side-v2.png` |

Notes:

- v1/v2 use the existing `/prototype?scene=...` route with added scene entries under `data/scenes/`; this does not alter the prototype viewer.
- The screenshots show the same golden object, green Porsche artwork, dark suede back/frame, white background, and environment. Studio.app includes editor UI and a different viewport framing, so this is render parity, not pixel-identical full-window UI parity.
- `verification/verification-results.json` has zero failures. Prototype telemetry has no console errors, page errors, request failures, bad responses, dialogs, or WebGL failure text. Studio telemetry has no console errors, page errors, request failures, bad responses, or dialogs.

## Build Output

Command:

```bash
cd studio-v2
npm run build 2>&1 | tee docs/verification/npm-run-build-studio-v2.log
```

Result: exit 0. Full output: `verification/npm-run-build-studio-v2.log`.

Key output excerpt:

```text
> @onemo/studio-v2@0.1.0 build
> npm run build:renderer && electron-builder --mac dir

> @onemo/studio-v2@0.1.0 build:renderer
> vite build

vite v7.3.5 building client environment for production...
✓ 308 modules transformed.
✓ built in 3.20s
  • electron-builder  version=26.8.1 os=25.5.0
  • packaging       platform=darwin arch=arm64 electron=42.3.3 appOutDir=dist-electron/mac-arm64
  • skipped macOS code signing  reason=identity explicitly is set to null
  • arm64 requires signing, but identity is set to null and signing is being skipped
```

Warnings present in the log:

- Vite warns that legacy editor scripts in `index.html` are not bundled because they are not module scripts.
- Vite warns about dynamic/static import chunk placement and one large editor chunk.
- Electron Builder warns that this internal macOS directory build is unsigned because `identity` is explicitly `null`.

No build errors occurred.

## Studio.app Launch And Native Open

PASS.

Evidence:

- Packaged app exists: `studio-v2/dist-electron/mac-arm64/Studio.app`.
- App bundle state from Electron: `isPackaged: true`, app name `Studio`, window title `ONEMO Studio v2`, visible window bounds `1440x980`, application menu is `null`.
- `Info.plist` has `CFBundleName`/`CFBundleDisplayName` `Studio` and `CFBundleIconFile` `icon.icns`.
- Native `Open .onemo...` was driven through the packaged app menu with the dialog patched to return `public/assets/templates/golden-effect-70mm/v2-draco-decimated-smooth.onemo`.
- Screenshot: `verification/studio-app-native-open-v2.png`.

Native-open state in `verification/verification-results.json`:

```json
{
  "desktopApi": true,
  "rootName": "golden-prototype",
  "meshNames": ["BACK", "FRAME", "PRINT_SURFACE_FRONT"],
  "meshCount": 3,
  "printHasArtwork": true,
  "printSide": 0,
  "printMaterialType": "MeshPhysicalMaterial",
  "backHasSuedeMaps": true,
  "frameColor": "0f0f0f",
  "environment": true,
  "background": "ffffff",
  "cameraPosition": [0, 0, 0.2],
  "rendererToneMapping": 7,
  "rendererExposure": 0.7,
  "rendererShadows": true,
  "rendererShadowType": 2
}
```

## Three Provenance And Forbidden Refs

PASS.

Commands:

```bash
node -e "const path=require('node:path'); const fs=require('node:fs'); const root=path.resolve('studio-v2'); const main=require.resolve('three',{paths:[root]}); const pkg=path.join(root,'node_modules/three/package.json'); console.log(main); console.log(JSON.parse(fs.readFileSync(pkg,'utf8')).version);"
npm ls three --prefix studio-v2
```

I also ran a repo-wide ripgrep scan for the external editor-clone reference, excluding dependency folders and generated build output (`node_modules`, `studio-v2/node_modules`, `studio-v2/dist`, `studio-v2/dist-electron`, `.next`, and `studio/data`). It returned 0 matches.

Observed:

```text
/Users/daniilsolopov/Dev/onemo-dev/onemo-next/.claude/worktrees/s56-studio-v2/studio-v2/node_modules/three/build/three.cjs
0.183.2
```

```text
@onemo/studio-v2@0.1.0
├─┬ three-gpu-pathtracer@0.0.23
│ └── three@0.183.2 deduped
├─┬ three-mesh-bvh@0.7.4
│ └── three@0.183.2 deduped
└── three@0.183.2
```

The forbidden reference search returned no matches. The only committed files under `studio-v2/public/vendor/three` are static decoder/font assets needed by the editor and Draco path:

```text
studio-v2/public/vendor/three/examples/fonts/helvetiker_bold.typeface.json
studio-v2/public/vendor/three/examples/jsm/libs/basis/basis_transcoder.js
studio-v2/public/vendor/three/examples/jsm/libs/basis/basis_transcoder.wasm
studio-v2/public/vendor/three/examples/jsm/libs/draco/draco_decoder.js
studio-v2/public/vendor/three/examples/jsm/libs/draco/draco_decoder.wasm
studio-v2/public/vendor/three/examples/jsm/libs/draco/draco_encoder.js
studio-v2/public/vendor/three/examples/jsm/libs/draco/draco_wasm_wrapper.js
studio-v2/public/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.js
studio-v2/public/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm
studio-v2/public/vendor/three/examples/jsm/libs/draco/gltf/draco_encoder.js
studio-v2/public/vendor/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js
```

## Additional Checks

Commands run from repo root:

```bash
npm run typecheck
npm test -- --run
npm run lint
npm run build
git diff --check
```

Results:

- `npm run typecheck`: exit 0.
- `npm test -- --run`: exit 0, 14 passed / 10 skipped.
- `npm run lint`: exit 0 with 10 existing warnings, 0 errors.
- `npm run build`: exit 0 with Next workspace-root and deprecated middleware warnings.
- `git diff --check`: exit 0.

## Artifacts

- `verification/verification-results.json`: structured pass/fail evidence.
- `verification/npm-run-build-studio-v2.log`: full Studio build output.
- `verification/side-by-side-v0.png`
- `verification/side-by-side-v1.png`
- `verification/side-by-side-v2.png`
- `verification/studio-app-native-open-v2.png`
