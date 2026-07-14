/** Closed HTTP adapter for the truthful Compiler v2 Studio controller. */
const ID = '[a-z0-9][a-z0-9-]{0,79}';
const RUNTIME = new RegExp(`^/api/compiler-v2/runtime/(${ID})/(index\\.html|bundle\\.css|bundle\\.js)$`);
const ACTION = new RegExp(`^/api/compiler-v2/(commit|cancel)/(${ID})$`);

export function dispatchV2StudioRequest({ method, pathname, studio, legacy }) {
  if (!pathname.startsWith('/api/compiler-v2/')) return null;
  try {
    if (pathname === '/api/compiler-v2/status') {
      if (method !== 'GET') return methodNotAllowed('GET');
      return json(200, studio.snapshot(legacy));
    }
    const runtime = pathname.match(RUNTIME);
    if (runtime) {
      if (method !== 'GET') return methodNotAllowed('GET');
      const [, transactionId, artifact] = runtime;
      let bytes = studio.runtime(transactionId, artifact);
      if (artifact === 'index.html') bytes = rewriteRuntimeShell(bytes, transactionId);
      return {
        status: 200,
        headers: {
          'content-type': artifact === 'index.html' ? 'text/html; charset=utf-8'
            : artifact === 'bundle.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
          'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-store',
        },
        body: bytes,
      };
    }
    const action = pathname.match(ACTION);
    if (action) {
      if (method !== 'POST') return methodNotAllowed('POST');
      const [, name, transactionId] = action;
      return json(200, studio[name](transactionId, legacy));
    }
    return json(404, { error: 'Compiler v2 Studio route not found' });
  } catch (error) {
    return json(422, { error: String(error?.message ?? error).slice(0, 4000), state: error?.state ?? 'FAILED_STATIC' });
  }
}

function rewriteRuntimeShell(bytes, transactionId) {
  const html = Buffer.from(bytes).toString('utf8');
  const css = 'href="/bundle.css"';
  const js = 'src="/bundle.js"';
  if (count(html, css) !== 1 || count(html, js) !== 1) throw new Error('Compiler v2 runtime shell asset references malformed');
  const base = `/api/compiler-v2/runtime/${transactionId}`;
  return Buffer.from(html.replace(css, `href="${base}/bundle.css"`).replace(js, `src="${base}/bundle.js"`));
}

function count(value, needle) {
  let found = 0;
  for (let at = value.indexOf(needle); at !== -1; at = value.indexOf(needle, at + needle.length)) found++;
  return found;
}

const json = (status, value) => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  body: JSON.stringify(value),
});

const methodNotAllowed = (allow) => ({ ...json(405, { error: `Method not allowed; use ${allow}` }), headers: { ...json(405, {}).headers, allow } });
