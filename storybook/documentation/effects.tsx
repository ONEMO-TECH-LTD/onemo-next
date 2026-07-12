'use client';

/**
 * Effects-tier documentation renderer. The tier is alias-only by law — every
 * ingredient is an existing primitive — so these views read two collections:
 * the alias strength/tint ranges and the semantic ladders that bind them.
 */

import React from 'react';
import { AL_FX, EFFECTS_COL, childrenOf, numeric, leafMeta, resolve, cssColor, splitAlpha } from './data';
import { S, Table, C } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in

/** The universal strength range: fx/<group>/<size> grid, values from the pull. */
export function StrengthRange() {
  const groups = childrenOf(AL_FX, 'fx');
  if (!groups.length) return null;
  const sizes = ['xs', 's', 'm', 'l', 'xl'];
  return (
    <Table head={['Group', ...sizes]}>
      {groups.map((g) => (
        <tr key={g}>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{`fx/${g}`}</C>
          </td>
          {sizes.map((s) => {
            const n = numeric(AL_FX, `fx/${g}/${s}`);
            return (
              <td key={s} style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                {n ?? '—'}
              </td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}

/** The semantic blur ladder: strength names, resolved px, live demo. */
export function BlurLadder() {
  const names = childrenOf(EFFECTS_COL, 'blur');
  if (!names.length) return null;
  const rows = names
    .map((n) => ({ name: n, px: numeric(EFFECTS_COL, `blur/${n}`), meta: leafMeta(EFFECTS_COL, `blur/${n}`) }))
    .sort((a, b) => (a.px ?? 0) - (b.px ?? 0));
  return (
    <Table head={['Strength', 'px', 'Binds', 'Demo (over imagery)']}>
      {rows.map((r) => (
        <tr key={r.name}>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{`blur/${r.name}`}</C>
          </td>
          <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>{r.px ?? '—'}</td>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{r.meta?.binding ?? ''}</C>
          </td>
          <td style={S.td}>
            <div
              style={{
                width: 120,
                height: 36,
                borderRadius: 8,
                background: PHOTO,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backdropFilter: `blur(${Math.min(r.px ?? 0, 40)}px)`,
                }}
              />
            </div>
          </td>
        </tr>
      ))}
    </Table>
  );
}

/** A semantic tint ladder (shadow/ or light/): intensity names over both grounds. */
export function TintLadder({ kind }: { kind: 'shadow' | 'light' }) {
  const names = childrenOf(EFFECTS_COL, kind);
  if (!names.length) return null;
  const rows = names
    .map((n) => ({ name: n, r: resolve(EFFECTS_COL, `${kind}/${n}`), meta: leafMeta(EFFECTS_COL, `${kind}/${n}`) }))
    .filter((x) => x.r)
    .sort((a, b) => (splitAlpha(a.r!.L).alpha ?? 0) - (splitAlpha(b.r!.L).alpha ?? 0));
  return (
    <Table head={['Intensity', 'Opacity', 'Binds', 'On light ground', 'On dark ground']}>
      {rows.map(({ name, r, meta }) => {
        const alpha = splitAlpha(r!.L).alpha;
        return (
          <tr key={name}>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <C>{`${kind}/${name}`}</C>
            </td>
            <td style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
              {alpha !== null ? `${Math.round(alpha * 100)}%` : '—'}
            </td>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <C>{meta?.binding ?? ''}</C>
            </td>
            {(['#fafafa', '#111113'] as const).map((ground) => (
              <td key={ground} style={S.td}>
                <div
                  style={{
                    width: 84,
                    height: 32,
                    borderRadius: 8,
                    background: ground,
                    border: '1px solid rgba(128,128,128,.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 60,
                      height: 18,
                      borderRadius: 5,
                      background: cssColor(r!.L),
                      display: 'inline-block',
                    }}
                  />
                </div>
              </td>
            ))}
          </tr>
        );
      })}
    </Table>
  );
}

/** The alias tint ranges behind the semantic ladders (shadow-tint/, light-tint/). */
export function TintRange({ kind }: { kind: 'shadow-tint' | 'light-tint' }) {
  const groups = childrenOf(AL_FX, kind);
  if (!groups.length) return null;
  const sizes = ['s', 'm', 'l'];
  return (
    <Table head={['Group', ...sizes.map((s) => s.toUpperCase())]}>
      {groups.map((g) => (
        <tr key={g}>
          <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
            <C>{`${kind}/${g}`}</C>
          </td>
          {sizes.map((s) => {
            const r = resolve(AL_FX, `${kind}/${g}/${s}`);
            const alpha = r ? splitAlpha(r.L).alpha : null;
            return (
              <td key={s} style={{ ...S.td, fontVariantNumeric: 'tabular-nums' }}>
                {alpha !== null ? `${Math.round(alpha * 100)}%` : '—'}
              </td>
            );
          })}
        </tr>
      ))}
    </Table>
  );
}
