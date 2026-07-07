/**
 * figma-to-code · C1.1 — desktop-bridge variable dump (SPEC §1 auto-refresh, s58-lead F6).
 *
 * The figma-console desktop bridge (Figma plugin ↔ local ws server, ports 9223-9231) can run
 * `figma.variables.getLocalVariablesAsync()` plugin-side — the ungated ID→name source.
 *
 * C1.1 scope (honest): PROBE the bridge and report reachability; the fallback instruction path
 * is the verified behavior. The full protocol client (send execute, collect result, write the
 * dump artifact) lands the first time a connected plugin exists to develop against — it cannot
 * be verified sooner, and unverified code doesn't ship (SPEC: no rule untested, no code unproven).
 */
import { createConnection } from 'node:net';

const BRIDGE_PORTS = [9223, 9224, 9225, 9226, 9227, 9228, 9229, 9230, 9231];

function tcpReachable(port, timeoutMs = 400, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port });
    const done = (v) => { try { sock.destroy(); } catch { /* gone */ } resolve(v); };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    setTimeout(() => done(false), timeoutMs);
  });
}

/** Probe for a bridge server with a CONNECTED plugin. Returns {ok, reason|fileVersion, count}. */
export async function tryBridgeDump(_root, _fileKey) {
  const up = [];
  for (const p of BRIDGE_PORTS) {
    // dial BOTH stacks — node MCP servers bind [::1] (IPv6); a 127.0.0.1-only probe reports a
    // healthy bridge as "not running" (live-hit 2026-07-07)
    if (await tcpReachable(p) || await tcpReachable(p, 400, '::1')) up.push(p);
  }
  if (up.length === 0) {
    return { ok: false, reason: 'no bridge server on 9223-9231 (figma-console MCP not running)' };
  }
  // Server(s) up — a connected PLUGIN is required for a dump; the protocol client that drives
  // it is deferred until a live plugin exists to verify against (see header). Until then the
  // manual snippet (printed by the CLI) is the working path.
  return {
    ok: false,
    reason: `bridge server up on ${up.join(',')} but the dump protocol client is pending its first ` +
      `live-plugin verification — use the printed snippet (Figma → Plugins → Development → Desktop Bridge)`,
  };
}
