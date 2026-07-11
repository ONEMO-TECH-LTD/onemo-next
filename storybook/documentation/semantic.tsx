'use client';

/**
 * Semantic-role documentation renderer for a colour family. Facts (bindings, values,
 * usage prose) come from the generated pull via the family dataset; this file only
 * decides how each role is demonstrated — which real surface the sample sits on.
 */

import React from 'react';
import {
  TEXT_FAMILY,
  GROUP_META,
  REMOVED,
  type TextToken,
  type ExampleSurface,
} from '../design-system/tokens/text-family.data';
import { resolve, PRIM_COL, cssColor } from './data';
import { S, Table, ValueLabel, C } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in (scenery, not a token)
const PHOTO_LIGHT = 'linear-gradient(135deg,#f6f2ec 0%,#e9e4da 100%)';

function ink(face: 'L' | 'D'): string {
  const r = resolve(PRIM_COL, 'base/brand-black');
  return r ? (face === 'L' ? r.L : r.D) : '#000';
}
function paper(face: 'L' | 'D'): string {
  const r = resolve(PRIM_COL, 'base/brand-white');
  return r ? (face === 'L' ? r.L : r.D) : '#fff';
}

function surfaceStyle(surface: ExampleSurface, face: 'L' | 'D', t: TextToken): React.CSSProperties {
  const pill: React.CSSProperties = {
    borderRadius: 999,
    padding: '0 13px',
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  switch (surface) {
    case 'ground':
      return {};
    case 'inverse-pill':
      return { ...pill, background: face === 'L' ? '#111113' : '#fcfcfd' };
    case 'flipping-pill':
      return { ...pill, background: face === 'L' ? ink('L') : paper('L') };
    case 'constant-ink-pill':
      return { ...pill, background: ink('L') };
    case 'constant-paper-pill':
      return { ...pill, background: paper('L'), border: face === 'L' ? '1px solid #e0e1e6' : 'none' };
    case 'photo':
      return { ...pill, background: PHOTO };
    case 'photo-light':
      return { ...pill, background: PHOTO_LIGHT };
    case 'tint':
      return { ...pill, background: face === 'L' ? t.tintLight : t.tintDark };
  }
}

function ExamplePair({ t }: { t: TextToken }) {
  const grounds: Array<{ face: 'L' | 'D'; bg: string; value: string }> = [
    { face: 'L', bg: '#fafafa', value: t.light },
    { face: 'D', bg: '#111113', value: t.dark },
  ];
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
          }}
        >
          <span
            style={{
              ...surfaceStyle(t.surface, g.face, t),
              color: cssColor(g.value + (t.alpha ? Math.round(t.alpha * 255).toString(16).padStart(2, '0') : '')),
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Ag
          </span>
        </div>
      ))}
    </div>
  );
}

const BEHAVIOR_LABEL: Record<TextToken['behavior'], string> = {
  adaptive: 'follows theme',
  inverse: 'opposite of theme',
  fixed: 'pinned · never flips',
};

/** One group of the text family as a documented table. */
export function TextGroup({ group }: { group: TextToken['group'] }) {
  const rows = TEXT_FAMILY.filter((t) => t.group === group);
  return (
    <>
      <p style={{ ...S.p, color: '#60646c', fontSize: 12.5 }}>{GROUP_META[group].note}</p>
      <Table head={['Role', 'Behavior · usage', 'Example (light · dark)', 'Binds', 'Values']}>
        {rows.map((t) => (
          <tr key={t.name}>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <C>{t.name}</C>
            </td>
            <td style={{ ...S.td, color: '#60646c', fontSize: 11.5, maxWidth: 280 }}>
              <b style={{ fontWeight: 650 }}>{BEHAVIOR_LABEL[t.behavior]}</b> — {t.usage}
            </td>
            <td style={S.td}>
              <ExamplePair t={t} />
            </td>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <C>{t.binding}</C>
            </td>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <ValueLabel value={t.light + (t.alpha ? Math.round(t.alpha * 255).toString(16).padStart(2, '0') : '')} />
              <br />
              <ValueLabel value={t.dark + (t.alpha ? Math.round(t.alpha * 255).toString(16).padStart(2, '0') : '')} />
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

export function TextGroupTitle({ group }: { group: TextToken['group'] }) {
  return <>{GROUP_META[group].title}</>;
}

/** The migration record: retired names and where their consumers went. */
export function RetiredNames() {
  return (
    <p style={{ ...S.p, fontSize: 12, color: '#8b8d98', lineHeight: 1.9 }}>
      {REMOVED.map((r, i) => (
        <span key={r.name}>
          <C>{r.name.replace('text/', '')}</C> → {r.to.replace('text/', '')}
          {i < REMOVED.length - 1 ? '  ·  ' : ''}
        </span>
      ))}
    </p>
  );
}

export const TEXT_GROUPS = ['max', 'primary', 'secondary', 'neutrals', 'brand', 'status'] as const;
