# Shopify Admin MCP configuration (ONE-144)

Use this to add the Shopify Admin MCP server to **Claude Desktop** (`claude_desktop_config.json`) or **Cursor** MCP settings.

## Credentials

The wrapper reads **SHOPIFY_APP_CLIENT_ID** and **SHOPIFY_APP_CLIENT_SECRET** from `.env.local` at the onemo-next project root. No need to put them in the MCP config — the token script loads them automatically.

Optional: set **SHOPIFY_STORE_DOMAIN** in the MCP config `env` (default: `onemo-dev.myshopify.com`).

## Config snippet

1. Replace `/ABSOLUTE/PATH/TO/onemo-next` with the real path to this repo (e.g. `/Users/daniilsolopov/onemo-next`).
2. Merge the `mcpServers` block into your existing MCP config.

Example merged into Claude Desktop config:

```json
{
  "mcpServers": {
    "shopify-admin": {
      "command": "node",
      "args": ["/Users/daniilsolopov/onemo-next/scripts/shopify-mcp-wrapper.mjs"],
      "env": {
        "SHOPIFY_STORE_DOMAIN": "onemo-dev.myshopify.com"
      }
    }
  }
}
```

Cursor: add the same `shopify-admin` entry under MCP servers in Cursor settings.

## Verify

- `node scripts/shopify-token.mjs` prints a valid `shpat_` token.
- `curl -X POST https://onemo-dev.myshopify.com/admin/api/2024-01/graphql.json -H "X-Shopify-Access-Token: <token>" -d '{"query":"{ shop { name } }"}'` returns shop data.
