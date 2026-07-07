// Headless Desktop-Bridge peer (C10.4 — Dan: "deterministic entire block … not needing agents").
//
// The figma-console Desktop Bridge PLUGIN is a WebSocket CLIENT: it scans ws://localhost:9223-9232
// and connects to every live server, then (a) pushes FILE_INFO + VARIABLES_DATA on connect —
// id, name, key, resolvedType, valuesByMode, collections with modes: the COMPLETE catalog — and
// (b) answers JSON-RPC requests {id, method, params} → {id, result|error} (EXECUTE_CODE,
// REFRESH_VARIABLES, …). So a headless dump needs no MCP and no agent: BE a server in the scan
// range and the plugin feeds you. This module is that server — zero dependencies, RFC6455 minimal
// (text frames, 16/64-bit lengths, masked client frames, fragmentation, ping/pong).
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// ── frame codec ──
function encodeText(str) {
  const payload = Buffer.from(str, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([header, payload]);
}
function makeDecoder(onMessage, onClose) {
  let buf = Buffer.alloc(0); let fragments = [];
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0, op = buf[0] & 0x0f, masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const maskOff = off, dataOff = masked ? off + 4 : off;
      if (buf.length < dataOff + len) return;
      let data = buf.subarray(dataOff, dataOff + len);
      if (masked) { const m = buf.subarray(maskOff, maskOff + 4); const d = Buffer.from(data); for (let i = 0; i < d.length; i++) d[i] ^= m[i & 3]; data = d; }
      buf = buf.subarray(dataOff + len);
      if (op === 0x8) { onClose(); return; }                    // close
      if (op === 0x9) continue;                                  // ping (plugin doesn't expect pong over this path)
      if (op === 0x1 || op === 0x0) {                            // text / continuation
        fragments.push(data);
        if (fin) { const msg = Buffer.concat(fragments).toString('utf8'); fragments = []; onMessage(msg); }
      }
    }
  };
}

/**
 * Start the bridge peer. Binds the FIRST free port in the plugin's scan range (9223-9232).
 * state.variables/state.fileInfo update on every push; request() round-trips an RPC to the plugin.
 * Returns { port, state, request, close } or throws if the whole range is occupied.
 */
export async function startBridgePeer({ log = () => {}, ports } = {}) {
  const state = { connected: false, port: null, variables: null, fileInfo: null, variablesAt: null };
  let ws = null; const pending = new Map(); const waiters = [];

  const http = createServer((_, res) => { res.writeHead(426); res.end(); });
  http.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = createHash('sha1').update(key + WS_MAGIC).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`);
    ws = socket; state.connected = true; log(`bridge plugin connected`);
    const decode = makeDecoder((msg) => {
      let m; try { m = JSON.parse(msg); } catch { return; }
      if (m.type === 'VARIABLES_DATA') { state.variables = m.data; state.variablesAt = Date.now(); waiters.splice(0).forEach((w) => w(m.data)); log(`VARIABLES_DATA: ${m.data?.variables?.length ?? 0} variables`); }
      else if (m.type === 'FILE_INFO') { state.fileInfo = m.data; log(`FILE_INFO: ${m.data?.fileKey ?? '?'}`); }
      else if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(m.error)) : resolve(m.result); }
    }, () => { state.connected = false; ws = null; log('bridge plugin disconnected'); });
    socket.on('data', decode);
    socket.on('error', () => { state.connected = false; ws = null; });
    socket.on('close', () => { state.connected = false; ws = null; });
  });

  // bind the first port free on BOTH loopback stacks — the plugin dials ws://localhost:<port>,
  // which resolves ::1 first; MCP servers hold ::1 only, so a wildcard/IPv4-only bind on their
  // port would never receive the plugin (live-hit). Explicitly claim ::1, mirror on 127.0.0.1.
  const PORTS = ports ?? [9232, 9231, 9230, 9229, 9228, 9227, 9226, 9225, 9224, 9223]; // top-down: 9232 is usually the free slot; tests pass [0] (ephemeral)
  const http4 = createServer((_, res) => { res.writeHead(426); res.end(); });
  http4.on('upgrade', (req, socket) => http.emit('upgrade', req, socket));
  const tryBind = (srv, host, port) => new Promise((res, rej) => { srv.once('error', rej); srv.listen(port, host, () => { srv.removeAllListeners('error'); res(); }); });
  let bound = null;
  for (const p of PORTS) {
    try { await tryBind(http, '::1', p); } catch { http.removeAllListeners('error'); continue; }
    try { await tryBind(http4, '127.0.0.1', p); } catch { /* IPv4 side busy — ::1 (what the plugin hits) is ours */ }
    bound = p; break;
  }
  if (bound == null) throw new Error('bridge peer: every port in 9223-9232 is occupied on ::1');
  if (bound === 0) bound = http.address().port;
  state.port = bound; log(`bridge peer listening on :${bound} (plugin discovers on its next scan)`);

  const request = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
    if (!ws) return reject(new Error('bridge plugin not connected — open the Desktop Bridge plugin in Figma'));
    const id = randomUUID();
    const timer = setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`bridge request ${method} timed out`)); } }, timeoutMs);
    timer.unref?.();
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    ws.write(encodeText(JSON.stringify({ id, method, params })));
  });
  /** freshest catalog: ask the plugin to re-read, then await the push (falls back to cache). */
  const freshVariables = async (timeoutMs = 15000) => {
    if (!ws) { if (state.variables) return state.variables; throw new Error('bridge plugin not connected — open the Desktop Bridge plugin in Figma'); }
    const pushed = new Promise((res) => { waiters.push(res); const t = setTimeout(() => res(null), timeoutMs); t.unref?.(); });
    await request('REFRESH_VARIABLES', {}).catch(() => {});    // some plugin builds reply via push only
    return (await pushed) ?? state.variables;
  };
  return { port: bound, state, request, freshVariables, close: () => { try { ws?.destroy(); } catch { /* gone */ } http.close(); http4.close(); } };
}
