'use client';

/**
 * Motion documentation renderer. Values resolve from the generated pull through the
 * full cascade at render time — the table carries no numbers of its own.
 */

import React from 'react';
import { leafMeta, numeric, childrenOf } from './data';
import { S, Table, C } from './blocks';

const SEM = '3.8-Sem-Motion';

/** Resolve a motion token to its raw value (number or string) by following leafMeta bindings. */
function rawValue(collection: string, path: string, depth = 0): string {
  if (depth > 8) return '—';
  const meta = leafMeta(collection, path);
  if (!meta) return '—';
  if (meta.binding === 'RAW') return String(meta.raw);
  const n = numeric(collection, path);
  if (n !== null) return String(Math.round(n * 1000) / 1000);
  // string chains: follow one hop into the alias tier, then the primitive
  for (const next of ['.2.7-Al-Motion', '.1.5-Prim-Motion', '.1.4-Prim-Ratios']) {
    const hop = leafMeta(next, meta.binding);
    if (hop) return hop.binding === 'RAW' ? String(hop.raw) : rawValue(next, meta.binding, depth + 1);
  }
  return '—';
}

export function MotionTable() {
  const groups = childrenOf(SEM);
  if (!groups.length) return null;
  return (
    <Table head={['Token', 'Resolves', 'Role']}>
      {groups.flatMap((g) =>
        childrenOf(SEM, g).map((leaf) => {
          const path = `${g}/${leaf}`;
          const meta = leafMeta(SEM, path);
          if (!meta) return null;
          return (
            <tr key={path}>
              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                <C>{path}</C>
              </td>
              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{rawValue(SEM, path)}</td>
              <td style={S.td}>{meta.description}</td>
            </tr>
          );
        }),
      )}
    </Table>
  );
}
