'use client';

/**
 * Semantic-role documentation renderer. Fully data-derived: the grammar is
 * machine-parseable by design, so each token's behavior label and demo surface
 * are computed from its name — no per-token presentation table to go stale.
 */

import React from 'react';
import { semanticFamily, resolve, PRIM_COL, cssColor, type SemToken } from './data';
import { S, Table, ValueLabel, C } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in (scenery, not a token)

function mono(face: 'L' | 'D', tone: 'ink' | 'snow'): string {
  const r = resolve(PRIM_COL, tone === 'ink' ? 'base/brand-black' : 'base/brand-white');
  return r ? (face === 'L' ? r.L : r.D) : tone === 'ink' ? '#000' : '#fff';
}

/** Parse the grammar's theme/constancy slots out of a token name's leaf. */
function slots(name: string) {
  const leaf = name.split('/').pop() ?? '';
  const inversePerma = /(^|-)inverse-perma$/.test(leaf);
  return {
    inversePerma,
    perma: !inversePerma && /(^|-)perma$/.test(leaf),
    inverse: /(^|-)inverse$/.test(leaf),
  };
}

function behaviorLabel(name: string): string {
  const s = slots(name);
  if (s.inversePerma) return 'dark-world reading pinned';
  if (s.perma) return 'light-world reading pinned';
  if (s.inverse) return 'opposes the theme';
  return 'follows the theme';
}

/**
 * Demo surface, derived from the grammar: pinned voices sit on the opposing
 * pinned material, inverse sits on the flipping control, max sits on imagery,
 * everything else on the theme ground.
 */
function surfaceStyle(name: string, face: 'L' | 'D'): React.CSSProperties {
  const pill: React.CSSProperties = {
    borderRadius: 999,
    padding: '0 13px',
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  const s = slots(name);
  const family = name.split('/')[1];
  if (family === 'max') return { ...pill, background: PHOTO };
  if (s.inversePerma) return { ...pill, background: mono('L', 'ink') }; // Snow-world readings live on Ink
  if (s.perma) return { ...pill, background: mono('L', 'snow'), border: face === 'L' ? '1px solid #e0e1e6' : 'none' };
  if (s.inverse) return { ...pill, background: face === 'L' ? mono('L', 'ink') : mono('L', 'snow') };
  return {};
}

function ExamplePair({ t }: { t: SemToken }) {
  const grounds: Array<{ face: 'L' | 'D'; bg: string; value: string }> = [
    { face: 'L', bg: '#fafafa', value: t.L },
    { face: 'D', bg: '#111113', value: t.D },
  ];
  const isGlyph = t.name.startsWith('fg/');
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
          <span style={{ ...surfaceStyle(t.name, g.face), color: cssColor(g.value), fontSize: 13, fontWeight: 600 }}>
            {isGlyph ? (
              <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: 'block' }}>
                <circle cx="7" cy="7" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="7" cy="7" r="1.6" fill="currentColor" />
              </svg>
            ) : (
              'Ag'
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One picker folder of a semantic tier, rendered as a documented table. */
export function FolderTable({ tier, folder }: { tier: 'text' | 'fg'; folder: string }) {
  const all = semanticFamily(`${tier}/`).filter(
    (t) => t.name === `${tier}/${folder}` || t.name.startsWith(`${tier}/${folder}/`),
  );
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
            <ExamplePair t={t} />
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

/** The folders of a tier, in the law's order, with material-language notes. */
export const FOLDERS: Array<{ folder: string; title: string; note: string }> = [
  {
    folder: 'primary',
    title: 'primary — the brand voice',
    note: 'Ink speaking on Snow, and Snow on Ink in the dark theme — the UI default. Registers quiet it; the theme and constancy suffixes redirect or pin it.',
  },
  {
    folder: 'max',
    title: 'max — the pure extremes',
    note: 'True black and white, outside the material vocabulary. Media and absolutes only — imagery text is picked from this folder by sampled luminance.',
  },
  {
    folder: 'system',
    title: 'system — the platform speaking',
    note: 'Statuses and field neutrals: validation, caution, confirmation, disabled, placeholder. Functional voices, never accents.',
  },
  {
    folder: 'brand',
    title: 'brand — colour used deliberately',
    note: 'The brand colours in allocation order. Each carries the same register and behavior suffixes; missing combinations mint at their predictable names.',
  },
];

export function FolderNote({ folder }: { folder: string }) {
  const f = FOLDERS.find((x) => x.folder === folder);
  return f ? <p style={{ ...S.p, color: '#60646c', fontSize: 12.5 }}>{f.note}</p> : null;
}
