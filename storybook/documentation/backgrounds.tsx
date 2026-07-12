'use client';

/**
 * Background-family documentation renderer. Data-derived like the other tiers:
 * folders and rows come from the pull; a folder that does not exist in the
 * snapshot renders nothing, so the page is always truthful to its source.
 */

import React from 'react';
import { semanticFamily, cssColor, splitAlpha, type SemToken } from './data';
import { S, Table, ValueLabel, C } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in

function behaviorLabel(name: string): string {
  const leaf = name.split('/').pop() ?? '';
  if (/(^|-)inverse-perma$/.test(leaf)) return 'dark-world reading pinned';
  if (/(^|-)perma$/.test(leaf)) return 'light-world reading pinned';
  if (/(^|-)inverse$/.test(leaf)) return 'opposes the theme';
  return 'follows the theme';
}

/** A surface swatch pair: the token painted as a fill over each theme ground. */
function SurfacePair({ t }: { t: SemToken }) {
  const translucent = splitAlpha(t.L).alpha !== null || splitAlpha(t.D).alpha !== null;
  const grounds: Array<{ face: 'L' | 'D'; bg: string; value: string }> = [
    { face: 'L', bg: translucent ? PHOTO : '#fafafa', value: t.L },
    { face: 'D', bg: translucent ? PHOTO : '#111113', value: t.D },
  ];
  const isFrost = t.name.startsWith('bg/frost/');
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {grounds.map((g) => (
        <div
          key={g.face}
          style={{
            width: 100,
            height: 48,
            borderRadius: 9,
            background: g.bg,
            border: '1px solid rgba(128,128,128,.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              width: 78,
              height: 30,
              borderRadius: 7,
              background: cssColor(g.value),
              backdropFilter: isFrost ? 'blur(6px)' : undefined,
              border: '1px solid rgba(128,128,128,.18)',
              display: 'inline-block',
            }}
          />
        </div>
      ))}
    </div>
  );
}

/** One bg/ folder (or the whole family with folder="") as a documented table. */
export function BgFolderTable({ folder }: { folder: string }) {
  const prefix = folder ? `bg/${folder}` : 'bg';
  const all = semanticFamily('bg/').filter((t) => t.name === prefix || t.name.startsWith(`${prefix}/`));
  if (!all.length) return null;
  return (
    <Table head={['Role', 'Theme · constancy', 'Usage', 'Example (light · dark)', 'Binds', 'Values']}>
      {all.map((t) => (
        <tr key={t.name}>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{t.name}</C>
          </td>
          <td style={{ ...S.td, whiteSpace: 'nowrap', color: '#60646c', fontSize: 11.5 }}>{behaviorLabel(t.name)}</td>
          <td style={{ ...S.td, color: '#60646c', fontSize: 11.5, minWidth: 200, maxWidth: 300 }}>{t.description}</td>
          <td style={S.td}>
            <SurfacePair t={t} />
          </td>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{t.binding}</C>
          </td>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <ValueLabel value={t.L} />
            <br />
            <ValueLabel value={t.D} />
          </td>
        </tr>
      ))}
    </Table>
  );
}
