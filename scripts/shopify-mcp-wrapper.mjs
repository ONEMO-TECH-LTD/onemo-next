#!/usr/bin/env node
/**
 * ONE-147: MCP wrapper launcher for Shopify Admin API.
 * Fetches a fresh Admin API token and launches shopify-mcp with it.
 * No background refresh — each MCP client spawn runs the wrapper once.
 *
 * Expects SHOPIFY_APP_CLIENT_ID and SHOPIFY_APP_CLIENT_SECRET in env
 * (or in .env.local read by the token script).
 * Optional: SHOPIFY_STORE_DOMAIN (default onemo-dev.myshopify.com).
 */

import { spawnSync, spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const tokenScript = resolve(projectRoot, "scripts", "shopify-token.mjs");

const storeDomain =
  process.env.SHOPIFY_STORE_DOMAIN || "onemo-dev.myshopify.com";

function getToken() {
  const result = spawnSync(
    process.execPath,
    [tokenScript],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SHOPIFY_STORE_DOMAIN: storeDomain,
      },
      cwd: projectRoot,
    }
  );

  if (result.error) {
    console.error("Failed to run token script:", result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const token = result.stdout?.trim();
  if (!token) {
    console.error("Token script produced no output.");
    process.exit(1);
  }

  return token;
}

const accessToken = getToken();

const child = spawn(
  "npx",
  [
    "shopify-mcp",
    "--accessToken",
    accessToken,
    "--domain",
    storeDomain,
  ],
  {
    stdio: "inherit",
    cwd: projectRoot,
    shell: true,
  }
);

child.on("error", (err) => {
  console.error("Failed to start shopify-mcp:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});
