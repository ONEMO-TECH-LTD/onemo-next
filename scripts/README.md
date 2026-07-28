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

## Automated device performance

`device-performance/` replaces the dead cable-based phone probe. It runs the engine automatically in
local WebKit:

```bash
npm run perf:devices
```

See `device-performance/README.md` for the explicit CPU-emulation limitation, report location, and
the provider-neutral paid-cloud adapter seam.
