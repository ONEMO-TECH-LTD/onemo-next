# Scripts

Build tools and utilities. Not runtime code — these run during development or CI.

> Note: the in-repo `tokens/` pipeline (build-tokens.mjs et al.) was retired in the v5.3.1 cleanup. The design-system token pipeline is now DS-V2.1 in `onemo-ssot-global/11-design-system/`; the generated `src/app/tokens/*.css` are kept until v5.4 adopts it.

## shopify/
Shopify API integration tools.

| Script | Purpose |
|---|---|
| `shopify-mcp-wrapper.mjs` | Shopify Admin MCP server wrapper for Claude/Cursor |
| `shopify-token.mjs` | Shopify API token management |

## 3d/
3D asset pipeline tools.

| Script | Purpose |
|---|---|
| `convert-obj-to-glb.py` | Blender headless: OBJ → GLB (historical — superseded by KeyShot pipeline) |

## Performance capability probe

`perf-core-s0/index.html` is the non-production S0 browser fixture for timestamps, correlation,
renderer-bound layout-effect commit detection, and bounded JSON export. It has no viewer,
observers, sampling, recorder, or reusable React/worker adapter. Serve it with:

```bash
npx vite scripts/perf-core-s0 --host 0.0.0.0 --port 4178
```

After retrieving the JSON string from `window.__ONEMO_PERF_S0_EXPORT__(metadata)`, verify its exact
sentinel and bounded payload:

```bash
node scripts/verify-perf-core-s0-export.mjs /absolute/path/to/export.json
```
