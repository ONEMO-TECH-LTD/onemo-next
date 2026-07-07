/**
 * figma-to-code · C1.1 — frame-URL parsing (SPEC §0).
 * `https://www.figma.com/design/<fileKey>/<name>?node-id=4084-25997` → { fileKey, nodeId }.
 * node-id URL form uses `-`; the API uses `:` — normalized here, once.
 */

export function parseFrameUrl(url) {
  const m = String(url).match(/figma\.com\/design\/([A-Za-z0-9]+)[^?]*\?(?:.*&)?node-id=(\d+[-:]\d+)/);
  if (!m) {
    throw new Error(
      `figma-to-code: not a frame URL (need https://www.figma.com/design/<fileKey>/…?node-id=<id>): ${url}`,
    );
  }
  return { fileKey: m[1], nodeId: m[2].replace('-', ':') };
}
