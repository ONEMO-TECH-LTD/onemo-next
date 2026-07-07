// C10.4 — bridge peer speaks real RFC6455: a genuine WebSocket client (node's built-in) must
// connect, receive requests, and have its pushes parsed — including a >64KB frame (the 1437-var
// catalog is ~1MB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startBridgePeer } from '../src/bridge-peer.mjs';

test('plugin-shaped client: connect → push VARIABLES_DATA (large frame) → answer an RPC', async () => {
  const peer = await startBridgePeer({ ports: [0] }); // ephemeral — never collide with the live studio peer
  try {
    const ws = new WebSocket(`ws://localhost:${peer.port}`);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    // large push (≈300KB → 64-bit-length frames on some paths, masked client frames always)
    const big = { success: true, fileKey: 'K', variables: Array.from({ length: 3000 }, (_, i) => ({ id: `VariableID:9:${i}`, name: `n/${i}`, variableCollectionId: 'C', valuesByMode: {} })), variableCollections: [{ id: 'C', name: 'Coll', modes: [], variableIds: [] }] };
    ws.send(JSON.stringify({ type: 'VARIABLES_DATA', data: big }));
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(peer.state.variables?.variables?.length, 3000, 'large masked frame decoded');
    // RPC round-trip: peer sends {id,method}, client answers {id,result}
    ws.onmessage = (e) => { const m = JSON.parse(e.data); ws.send(JSON.stringify({ id: m.id, result: { ok: true, method: m.method } })); };
    const res = await peer.request('REFRESH_VARIABLES', {});
    assert.deepEqual(res, { ok: true, method: 'REFRESH_VARIABLES' });
    ws.close();
  } finally { peer.close(); }
});
