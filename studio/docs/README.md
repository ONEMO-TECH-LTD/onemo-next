# ONEMO 3D Studio

The ONEMO 3D Studio is a forked PlayCanvas Editor (v2.20.1) where the rendering engine has been replaced with Three.js/R3F. PlayCanvas provides the editor UI (hierarchy panel, inspector, asset browser, toolbar, gizmo controls). Three.js/R3F provides the actual 3D rendering.

The studio produces `.onemo` template files that define 3D products. These templates are loaded by the user-facing configurator, where customers can customize colors, artwork, and materials.

## Launch

```bash
cd studio
npm install     # first time only
npm run build   # builds editor JS/CSS into dist/
node host/step1-server.mjs
```

Open `http://127.0.0.1:3487` in Chrome.

The `step1-server.mjs` host generates the HTML shell dynamically, serves the editor assets, manages a ShareDB backend for real-time entity state, and provides the asset/scene APIs.

**Do NOT use `npm run serve`** — that's a static file server with no HTML shell.

## Folder Structure

```
studio/
├── docs/                          # documentation
│   ├── README.md                  # ← you are here
│   ├── architecture.md            # how the studio is built
│   ├── onemo-format.md            # .onemo file format specification
│   ├── pipeline.md                # scene pipeline: studio → .onemo → viewer
│   ├── decisions.md               # architectural decision references
│   └── development/               # audit docs, feature references, build history
│       ├── audit-spec.md          # source-driven audit checklist
│       ├── editor-feature-reference.md
│       ├── r3f-threejs-capabilities.md
│       └── ... (audit findings, fix reports)
├── host/
│   └── step1-server.mjs           # local dev server (ShareDB, asset registry, scene API)
├── src/
│   ├── editor/                    # PlayCanvas editor source (UI shell)
│   │   ├── adapter/               # Observer↔R3F bridge (23 mapper files)
│   │   ├── inspector/             # property inspector panels
│   │   ├── viewport/              # viewport controls + R3F mount
│   │   └── ...
│   ├── editor-api/                # editor API layer
│   └── common/                    # shared utilities, thumbnail renderers
├── sass/                          # editor stylesheets
├── vendor/                        # vendored PlayCanvas engine (loaded via script tag)
├── static/                        # fonts, images, JSON fixtures
├── data/                          # runtime data (saved scenes)
│   └── scenes/                    # .onemo or legacy JSON scene files
└── public → ../public             # shared assets (models, textures, env maps)
```

## Key Concepts

- **PlayCanvas = UI shell.** Provides hierarchy, inspector, asset browser, toolbar. Does NOT own scene data.
- **Three.js = rendering engine.** The visible viewport is an R3F overlay. The PlayCanvas canvas is hidden.
- **Bridge = adapter layer.** 23 mapper files translate between PlayCanvas observers and Three.js objects.
- **.onemo = scene format.** GLB + studio.json sidecar in a ZIP. See `onemo-format.md`.
- **Templates vs configs.** The studio produces templates. The configurator stores user configs in a database.

## Related Docs

- [Architecture](architecture.md) — how the studio is built internally
- [.onemo Format](onemo-format.md) — scene file format specification
- [Pipeline](pipeline.md) — end-to-end scene flow from studio to user viewer
- [Decisions](decisions.md) — architectural decision references
