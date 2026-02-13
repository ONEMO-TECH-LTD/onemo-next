#!/usr/bin/env node
/**
 * ONE-18: Manual E2E verification for Cloudinary asset storage.
 * 1. Generates signed upload params (same logic as /api/upload-permission).
 * 2. Uploads a 1x1 PNG to the returned folder via Cloudinary Upload API.
 * 3. Verifies the asset exists (upload response contains expected public_id).
 * 4. Deletes the test asset via Admin API.
 *
 * Usage: node scripts/test-cloudinary-upload.mjs
 * Requires: .env.local with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
 *            Optional: CLOUDINARY_ENV_PREFIX (e.g. dev/) for folder isolation.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");

// 1x1 transparent PNG
const ONE_BY_ONE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(envPath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error("Missing .env.local. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
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
    const rest = trimmed.slice(eq + 1).trim();
    let value;
    if (rest.startsWith('"') && rest.endsWith('"')) {
      value = rest.slice(1, -1).replace(/\\"/g, '"');
    } else if (rest.startsWith("'") && rest.endsWith("'")) {
      value = rest.slice(1, -1).replace(/\\'/g, "'");
    } else {
      const commentIdx = rest.indexOf(" #");
      value = commentIdx >= 0 ? rest.slice(0, commentIdx).trimEnd() : rest;
    }
    env[key] = value;
  }
  return env;
}

function signParams(params, apiSecret) {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const toSign = sorted + apiSecret;
  return createHash("sha1").update(toSign).digest("hex");
}

async function main() {
  const env = loadEnvLocal();
  const cloudName =
    env.CLOUDINARY_CLOUD_NAME ?? env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  const prefix = (env.CLOUDINARY_ENV_PREFIX ?? "").replace(/\/?$/, "");
  const prefixWithSlash = prefix ? `${prefix}/` : "";

  if (!cloudName || !apiKey || !apiSecret) {
    console.error(
      "Missing CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET in .env.local"
    );
    process.exit(1);
  }

  const folder = `${prefixWithSlash}onemo-designs/private/customer_e2e-test/`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ folder, timestamp }, apiSecret);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
  const form = new FormData();
  form.append("file", `data:image/png;base64,${ONE_BY_ONE_PNG_BASE64}`);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("signature", signature);
  form.append("folder", folder.replace(/\/$/, ""));

  let uploadRes;
  try {
    uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
  } catch (err) {
    console.error("Upload request failed:", err.message);
    process.exit(1);
  }

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    console.error(`Upload failed (${uploadRes.status}): ${text}`);
    process.exit(1);
  }

  const uploadJson = await uploadRes.json();
  const publicId = uploadJson.public_id;

  if (!publicId) {
    console.error("Upload response missing public_id:", JSON.stringify(uploadJson));
    process.exit(1);
  }

  const expectedPrefix = folder.replace(/\/$/, "");
  if (!publicId.startsWith(expectedPrefix)) {
    console.error(
      `Upload landed in wrong folder: expected prefix "${expectedPrefix}", got public_id "${publicId}"`
    );
    await deleteAsset(cloudName, apiKey, apiSecret, publicId);
    process.exit(1);
  }

  console.log("PASS: Upload landed in", publicId);

  await deleteAsset(cloudName, apiKey, apiSecret, publicId);
  console.log("PASS: Test asset deleted.");
}

async function deleteAsset(cloudName, apiKey, apiSecret, publicId) {
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `public_ids[]=${publicId}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  const url = new URL(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload`
  );
  url.searchParams.set("public_ids[]", publicId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("signature", signature);

  const delRes = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
    },
  });

  if (!delRes.ok) {
    const text = await delRes.text();
    console.error("Delete failed (cleanup):", delRes.status, text);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
