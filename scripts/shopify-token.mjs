#!/usr/bin/env node
/**
 * ONE-146: Token exchange script for Shopify Admin API.
 * Exchanges client credentials for a 24-hour Admin API access token.
 * Reads SHOPIFY_APP_CLIENT_ID and SHOPIFY_APP_CLIENT_SECRET from .env.local.
 *
 * Usage: node scripts/shopify-token.mjs
 * Output: access token only (stdout), or error to stderr and exit 1.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("Missing .env.local at project root. Add SHOPIFY_APP_CLIENT_ID and SHOPIFY_APP_CLIENT_SECRET.");
      process.exit(1);
    }
    throw err;
  }

  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      env[key] = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      env[key] = value.slice(1, -1).replace(/\\'/g, "'");
    } else {
      env[key] = value.split("#")[0].trim();
    }
  }
  return env;
}

const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || "onemo-dev.myshopify.com";
const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;

async function main() {
  const env = loadEnvLocal();
  const clientId = env.SHOPIFY_APP_CLIENT_ID;
  const clientSecret = env.SHOPIFY_APP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Missing SHOPIFY_APP_CLIENT_ID or SHOPIFY_APP_CLIENT_SECRET in .env.local"
    );
    process.exit(1);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Token exchange failed (${res.status}): ${text}`);
    process.exit(1);
  }

  const data = await res.json();
  const token = data.access_token;

  if (!token) {
    console.error("Response missing access_token:", JSON.stringify(data));
    process.exit(1);
  }

  process.stdout.write(token);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
