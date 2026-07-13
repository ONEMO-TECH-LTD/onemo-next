'use client';

/**
 * Materials documentation renderers — the base pairs and their behavior grids.
 * Data-derived: a pair absent from the snapshot renders nothing, so the page
 * stays truthful to the committed pull.
 */

import React from 'react';
import { PRIM_COL, AL_COL, resolve, cssColor, splitAlpha } from './data';
import { S, Table, ValueLabel, C } from './blocks';

function Sw({ v }: { v: string }) {
  return (
    <span
      style={{
        width: 26,
        height: 18,
        borderRadius: 4,
        background: cssColor(v),
        border: '1px solid rgba(128,128,128,.3)',
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}

const PAIRS: Array<{ canonical: string; flip: string }> = [
  { canonical: 'ink-snow', flip: 'snow-ink' },
  { canonical: 'silver-space', flip: 'space-silver' },
  { canonical: 'white-black', flip: 'black-white' },
];

/** The base pairs: canonical in base/, flip in inverse/base/ — both faces shown. */
export function BaseMaterials() {
  const rows: Array<{ path: string; r: { L: string; D: string } }> = [];
  for (const p of PAIRS) {
    const canon = resolve(PRIM_COL, `base/${p.canonical}`);
    if (canon) rows.push({ path: `base/${p.canonical}`, r: canon });
    const flip = resolve(PRIM_COL, `inverse/base/${p.flip}`);
    if (flip) rows.push({ path: `inverse/base/${p.flip}`, r: flip });
  }
  if (!rows.length) return null;
  return (
    <Table head={['Primitive', 'Light face', 'Dark face']}>
      {rows.map(({ path, r }) => (
        <tr key={path}>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{path}</C>
          </td>
          {(['L', 'D'] as const).map((f) => (
            <td key={f} style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <Sw v={r[f]} /> <ValueLabel value={r[f]} />
            </td>
          ))}
        </tr>
      ))}
    </Table>
  );
}

/** One pair's alias anatomy: the adaptive entry + its transparency ladder. */
export function PairGrid({ family, pair }: { family: 'base' | 'brand'; pair: string }) {
  const base = resolve(AL_COL, `${family}/${pair}`);
  if (!base) return null;
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <code style={{ ...S.code, minWidth: 190 }}>
          {family}/{pair}
        </code>
        <Sw v={base.L} /> <Sw v={base.D} />
        <span style={{ ...S.mono, color: '#8b8d98' }}>
          <ValueLabel value={base.L} /> · <ValueLabel value={base.D} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5, margin: '4px 0 0 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <code style={{ ...S.code, minWidth: 190 }}>
          {family}/{pair}-alpha/…
        </code>
        {Array.from({ length: 12 }, (_, i) => {
          const r = resolve(AL_COL, `${family}/${pair}-alpha/${i + 1}`);
          if (!r) return null;
          const { alpha } = splitAlpha(r.L);
          return (
            <span key={i} style={{ textAlign: 'center' }}>
              <Sw v={r.L} />
              <div style={{ ...S.mono, fontSize: 7.5, color: '#8b8d98' }}>
                {alpha !== null ? `${Math.round(alpha * 100)}` : ''}
              </div>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** One face's pinned anatomy: the constant + its pinned transparency ladder. */
export function FaceGrid({ family, face }: { family: 'base' | 'brand'; face: string }) {
  const c = resolve(AL_COL, `${family}/${face}-constant`);
  if (!c) return null;
  return (
    <div style={{ margin: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <code style={{ ...S.code, minWidth: 190 }}>
          {family}/{face}-constant
        </code>
        <Sw v={c.L} /> <Sw v={c.D} />
        <span style={{ ...S.mono, color: '#8b8d98' }}>
          <ValueLabel value={c.L} /> · <ValueLabel value={c.D} />
        </span>
      </div>
      <div style={{ display: 'flex', gap: 5, margin: '4px 0 0 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <code style={{ ...S.code, minWidth: 190 }}>
          {family}/{face}-constant-alpha/…
        </code>
        {Array.from({ length: 12 }, (_, i) => {
          const r = resolve(AL_COL, `${family}/${face}-constant-alpha/${i + 1}`);
          if (!r) return null;
          return (
            <span key={i}>
              <Sw v={r.L} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
