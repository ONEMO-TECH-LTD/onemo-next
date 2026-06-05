# ONEMO Studio v2

Vite + TypeScript subproject for the ONEMO Studio editor.

This is an owned in-repo port of the ONEMO three.js editor fork. The editor source lives in `editor-js/`; Vite resolves `three`, `three/webgpu`, and `three/addons/*` from `node_modules` instead of the external `_3d-editor-eval` clone.

## Commands

```bash
npm install
npm run dev
npm run build
```

`npm run dev` serves the editor at `http://127.0.0.1:8088/`.
