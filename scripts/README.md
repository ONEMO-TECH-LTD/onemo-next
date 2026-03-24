# Scripts

Build tools and utilities. Not runtime code — these run during development or CI.

## tokens/
Design token pipeline — reads Figma Variables JSON, generates CSS.

| Script | Purpose |
|---|---|
| `build-tokens.mjs` | Main pipeline: Figma JSON → 4 CSS files in `src/app/tokens/` |
| `tokens.config.mjs` | Pipeline configuration |
| `test-build-tokens.mjs` | Pipeline tests |
| `validate-tokens.mjs` | Token validation checks |
| `generate-token-mapping.mjs` | Generates token mapping reference |
| `blueprint-validator.mjs` | DS blueprint validation |
| `token-mapping.json` | Token mapping data (generated) |
| `token-mapping.md` | Token mapping docs (generated) |

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
