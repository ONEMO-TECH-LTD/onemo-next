# ONEMO Studio v2

Vite + TypeScript subproject for the ONEMO Studio editor.

This is an owned in-repo port of the ONEMO three.js editor fork. The editor source lives in `editor-js/`; Vite resolves `three`, `three/webgpu`, and `three/addons/*` from `node_modules` instead of the external `_3d-editor-eval` clone.

## Commands

```bash
npm install
npm run dev
npm run build:renderer
npm run build
```

`npm run dev` serves the editor at `http://127.0.0.1:8088/`.
`npm run build:renderer` builds only the Vite web app into `dist/`.
`npm run build` builds the renderer and then runs electron-builder to produce `dist-electron/mac*/Studio.app`.

## Desktop App

KAI-8319 packages Studio v2 as an Electron app:

```bash
npm run build
open dist-electron/mac*/Studio.app
```

The packaged app opens a frameless/chromeless `BrowserWindow` with the ONEMO app icon and loads the built renderer through the app-local `onemo-studio://` protocol. Product assets are bundled from `../public/assets` into the app resources so `/assets/...` paths keep working in Finder-launched `Studio.app`.

For local asset overrides, set `ONEMO_STUDIO_ASSETS_DIR` to a filesystem path containing the same `assets/` structure before launching the app.

Inside Electron, `ONEMO > Open .onemo...` uses a native macOS file dialog and reads the selected `.onemo` via the preload bridge. In the browser dev server, the same menu falls back to Chromium's file picker.
