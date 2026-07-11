'use client';

/**
 * Documentation building blocks — presentational only. All colour comes in as data;
 * these components never hold token values of their own (prose law).
 */

import React from 'react';
import { cssColor, splitAlpha } from './data';

const FONT = 'ui-sans-serif, -apple-system, "SF Pro Text", system-ui, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

export const S = {
  page: { fontFamily: FONT, color: '#071013', maxWidth: 980, padding: '8px 8px 64px', lineHeight: 1.55 } as React.CSSProperties,
  h1: { fontSize: 26, fontWeight: 650, letterSpacing: '-0.02em', margin: '18px 0 6px' } as React.CSSProperties,
  h2: { fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em', margin: '34px 0 6px', paddingBottom: 5, borderBottom: '1px solid #e0e1e6' } as React.CSSProperties,
  h3: { fontSize: 13.5, fontWeight: 650, margin: '22px 0 4px' } as React.CSSProperties,
  p: { fontSize: 13.5, color: '#3a3f45', margin: '6px 0', maxWidth: '78ch' } as React.CSSProperties,
  lead: { fontSize: 14.5, color: '#3a3f45', margin: '4px 0 14px', maxWidth: '74ch' } as React.CSSProperties,
  code: { fontFamily: MONO, fontSize: '0.86em', background: '#f0f0f3', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' } as React.CSSProperties,
  faint: { color: '#8b8d98' } as React.CSSProperties,
  mono: { fontFamily: MONO, fontSize: 10.5, whiteSpace: 'nowrap' } as React.CSSProperties,
  th: { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8b8d98', textAlign: 'left', fontWeight: 650, padding: '8px 10px', borderBottom: '1px solid #e0e1e6', whiteSpace: 'nowrap' } as React.CSSProperties,
  td: { padding: '8px 10px', borderBottom: '1px solid #f0f0f3', verticalAlign: 'middle', fontSize: 12.5 } as React.CSSProperties,
};

export function Page({ title, lead, children }: { title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={S.page}>
      <h1 style={S.h1}>{title}</h1>
      {lead ? <div style={S.lead}>{lead}</div> : null}
      {children}
    </div>
  );
}

export const H2 = ({ children }: { children: React.ReactNode }) => <h2 style={S.h2}>{children}</h2>;
export const P = ({ children }: { children: React.ReactNode }) => <div style={S.p}>{children}</div>;
export const C = ({ children }: { children: React.ReactNode }) => <code style={S.code}>{children}</code>;

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...S.p, borderLeft: '3px solid #e0e1e6', paddingLeft: 10, color: '#60646c', fontSize: 12.5 }}>{children}</div>
  );
}

/** Checkerboard under translucent swatches so transparency is visible. */
const CHECKER =
  'repeating-conic-gradient(#e4e4e9 0% 25%, #ffffff 0% 50%) 0 0 / 10px 10px';

export function Swatch({ value, size = 26, title }: { value: string; size?: number; title?: string }) {
  const { alpha } = splitAlpha(value);
  return (
    <span
      title={title ?? value}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: 6,
        background: alpha !== null ? CHECKER : undefined,
        boxShadow: 'inset 0 0 0 1px rgba(128,128,128,.25)',
        overflow: 'hidden',
        verticalAlign: 'middle',
        position: 'relative',
      }}
    >
      <span style={{ position: 'absolute', inset: 0, background: cssColor(value), borderRadius: 6 }} />
    </span>
  );
}

/** A 12-step ramp strip for one theme face. */
export function RampStrip({ steps, face }: { steps: Array<{ step: number; L: string; D: string }>; face: 'L' | 'D' }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {steps.map((s) => (
        <div key={s.step} style={{ textAlign: 'center' }}>
          <Swatch value={face === 'L' ? s.L : s.D} size={30} title={`${s.step} · ${face === 'L' ? s.L : s.D}`} />
          <div style={{ ...S.mono, fontSize: 8.5, color: '#8b8d98', marginTop: 1 }}>{s.step}</div>
        </div>
      ))}
    </div>
  );
}

/** Family row: name + both theme faces side by side. */
export function FamilyRamp({ name, steps }: { name: string; steps: Array<{ step: number; L: string; D: string }> }) {
  if (!steps.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '7px 0', flexWrap: 'wrap' }}>
      <code style={{ ...S.code, minWidth: 120 }}>{name}</code>
      <RampStrip steps={steps} face="L" />
      <RampStrip steps={steps} face="D" />
    </div>
  );
}

/** Value label rendered from data (never typed): hex + optional computed opacity. */
export function ValueLabel({ value }: { value: string }) {
  const { hex, alpha } = splitAlpha(value);
  return (
    <span style={S.mono}>
      {hex}
      {alpha !== null ? ` @${Math.round(alpha * 100)}%` : ''}
    </span>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e0e1e6', borderRadius: 10, overflowX: 'auto', margin: '10px 0' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} style={S.th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

