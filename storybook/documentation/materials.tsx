'use client';

/**
 * Materials documentation renderer — the brand mono set and its behavior grids.
 * Data-derived: a base material absent from the snapshot renders nothing, so
 * the page stays truthful to the committed pull.
 */

import React from 'react';
import { PRIM_COL, AL_COL, resolve, childrenOf, cssColor } from './data';
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

/** The base materials: every base/ pair with both faces. */
export function BaseMaterials() {
  const names = childrenOf(PRIM_COL, 'base');
  if (!names.length) return null;
  return (
    <Table head={['Primitive', 'Light face', 'Dark face']}>
      {names.map((n) => {
        const r = resolve(PRIM_COL, `base/${n}`);
        if (!r) return null;
        return (
          <tr key={n}>
            <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
              <C>{`base/${n}`}</C>
            </td>
            {(['L', 'D'] as const).map((f) => (
              <td key={f} style={{ ...S.td, whiteSpace: 'nowrap' }}>
                <Sw v={r[f]} /> <ValueLabel value={r[f]} />
              </td>
            ))}
          </tr>
        );
      })}
    </Table>
  );
}

/**
 * The behavior grid of one alias material (e.g. brand/alu): constants, inverse,
 * and the three alpha ladders, each row resolved live from the pull.
 */
export function BehaviorGrid({ alias }: { alias: string }) {
  const kids = childrenOf(AL_COL, alias);
  if (!kids.length) return null;
  const flat = kids.filter((k) => !['alpha', 'l-alpha', 'd-alpha'].includes(k));
  const ladders = kids.filter((k) => ['alpha', 'l-alpha', 'd-alpha'].includes(k));
  return (
    <>
      <Table head={['Route', 'Light', 'Dark']}>
        {[''].concat(flat).map((k) => {
          const path = k ? `${alias}/${k}` : alias;
          const r = resolve(AL_COL, path);
          if (!r) return null;
          return (
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
          );
        })}
      </Table>
      {ladders.length > 0 && (
        <Table head={['Ladder', ...Array.from({ length: 12 }, (_, i) => String(i + 1))]}>
          {ladders.map((lad) => (
            <tr key={lad}>
              <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                <C>{`${alias}/${lad}`}</C>
              </td>
              {Array.from({ length: 12 }, (_, i) => {
                const r = resolve(AL_COL, `${alias}/${lad}/${i + 1}`);
                return (
                  <td key={i} style={S.td}>
                    {r ? <Sw v={r.L} /> : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
