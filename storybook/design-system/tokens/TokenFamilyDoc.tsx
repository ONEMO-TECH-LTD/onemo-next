'use client';

/**
 * TokenFamilyDoc — generated-style documentation for a semantic colour family.
 *
 * Renders each token with: name · behavior · a live example ON ITS REAL SURFACE
 * (both themes side by side) · binding chain · per-theme values. The dataset is
 * the pilot snapshot (text-family.data.ts); at DS lock the same component renders
 * straight off the ds-pipeline converter output.
 */

import React from 'react';
import {
  TEXT_FAMILY,
  GROUP_META,
  REMOVED,
  type TextToken,
  type ExampleSurface,
} from './text-family.data';
import { relLuminance, pickOnColour, FAMILY_RAMPS } from './adaptive-text';

const INK = '#071013';
const PAPER = '#fafafa';
const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)';
const PHOTO_LIGHT = 'linear-gradient(135deg,#f6f2ec 0%,#e9e4da 100%)';

function rgba(hex: string, a?: number): string {
  if (a === undefined || a >= 1) return hex;
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** What sits under the text in a given theme panel, per surface class. */
function surfaceStyle(surface: ExampleSurface, theme: 'light' | 'dark', t: TextToken): React.CSSProperties {
  const pill: React.CSSProperties = {
    borderRadius: 999,
    padding: '0 14px',
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
  switch (surface) {
    case 'ground':
      return {}; // text sits straight on the panel ground
    case 'inverse-pill':
      return { ...pill, background: theme === 'light' ? '#111113' : '#fcfcfd' };
    case 'flipping-pill':
      return { ...pill, background: theme === 'light' ? INK : PAPER };
    case 'constant-ink-pill':
      return { ...pill, background: INK };
    case 'constant-paper-pill':
      return { ...pill, background: PAPER, border: theme === 'light' ? '1px solid #e0e1e6' : 'none' };
    case 'photo':
      return { ...pill, background: PHOTO };
    case 'photo-light':
      return { ...pill, background: PHOTO_LIGHT };
    case 'tint':
      return { ...pill, background: theme === 'light' ? t.tintLight : t.tintDark };
  }
}

function ExamplePair({ t }: { t: TextToken }) {
  const panels: { theme: 'light' | 'dark'; ground: string; value: string }[] = [
    { theme: 'light', ground: '#fafafa', value: t.light },
    { theme: 'dark', ground: '#111113', value: t.dark },
  ];
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {panels.map((p) => (
        <div
          key={p.theme}
          style={{
            width: 108,
            height: 52,
            borderRadius: 10,
            background: p.ground,
            border: '1px solid rgba(128,128,128,.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ ...surfaceStyle(t.surface, p.theme, t), color: rgba(p.value, t.alpha), fontSize: 14, fontWeight: 600 }}>
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
  fixed: 'fixed · never flips',
};

/** Imagery stand-ins, dark → light, for the luminance-pick demo. */
const IMAGE_SWEEP: { stops: [string, string]; label: string }[] = [
  { stops: ['#0b0e11', '#20262c'], label: 'night' },
  { stops: ['#1f2f28', '#3a6b52'], label: 'deep green' },
  { stops: ['#b0592f', '#3a6b52'], label: 'mid photo' },
  { stops: ['#e8b04b', '#b0592f'], label: 'warm mid' },
  { stops: ['#d9cfc0', '#b8a88f'], label: 'light textile' },
  { stops: ['#f6f2ec', '#e9e4da'], label: 'white product' },
];

const demoCaption: React.CSSProperties = {
  fontSize: 9.5,
  color: '#8b8d98',
  marginTop: 3,
  fontFamily: 'ui-monospace, Menlo, monospace',
};

/**
 * The unified adaptive-text law, computed LIVE on render — no hand-picked
 * colours anywhere in this section; the algorithm in adaptive-text.ts decides.
 */
function AdaptiveTextDemo() {
  return (
    <div>
      {/* images: sample luminance → max pair */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {IMAGE_SWEEP.map((img) => {
          const luma = (relLuminance(img.stops[0]) + relLuminance(img.stops[1])) / 2;
          const white = luma < 0.4;
          return (
            <div key={img.label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 128,
                  height: 60,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${img.stops[0]}, ${img.stops[1]})`,
                  border: '1px solid rgba(128,128,128,.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: white ? '#ffffff' : '#000000', fontSize: 13, fontWeight: 650 }}>ONEMO</span>
              </div>
              <div style={demoCaption}>
                luma {luma.toFixed(2)} → max-{white ? 'light' : 'dark'}
              </div>
            </div>
          );
        })}
      </div>

      {/* colours: same algorithm, candidates = the family's own 12 voices first */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {Object.keys(FAMILY_RAMPS).flatMap((fam) =>
          (['3', '9'] as const).map((step) => {
            const surface = FAMILY_RAMPS[fam].steps[step].L;
            const pick = pickOnColour(fam, surface);
            return (
              <div key={fam + step} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 128,
                    height: 60,
                    borderRadius: 10,
                    background: surface,
                    border: '1px solid rgba(128,128,128,.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ color: pick.hex, fontSize: 13, fontWeight: 650 }}>ONEMO</span>
                </div>
                <div style={demoCaption}>
                  {fam}/{step} → {pick.token.replace(fam + '/', 'own ').replace(' voice)', ')')}
                </div>
                <div style={demoCaption}>
                  {pick.ratio.toFixed(2)} {pick.body ? '✓ body' : '△ large-only'}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    fontFamily: 'ui-sans-serif, -apple-system, system-ui, sans-serif',
    color: 'var(--sem-col-text-primary, #071013)',
    maxWidth: 1080,
    padding: '8px 4px 48px',
  } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 650, letterSpacing: '-0.02em', margin: '0 0 4px' } as React.CSSProperties,
  sub: { fontSize: 12.5, color: '#8b8d98', margin: '0 0 8px', maxWidth: '90ch' } as React.CSSProperties,
  group: { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60646c', margin: '26px 0 2px' } as React.CSSProperties,
  note: { fontSize: 11.5, color: '#8b8d98', margin: '0 0 8px', maxWidth: '90ch' } as React.CSSProperties,
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12.5 } as React.CSSProperties,
  th: { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8b8d98', textAlign: 'left', fontWeight: 650, padding: '8px 10px', borderBottom: '1px solid #e0e1e6', whiteSpace: 'nowrap' } as React.CSSProperties,
  td: { padding: '8px 10px', borderBottom: '1px solid #f0f0f3', verticalAlign: 'middle' } as React.CSSProperties,
  code: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.87em', background: 'rgba(128,128,128,.12)', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' } as React.CSSProperties,
  val: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 10.5, whiteSpace: 'nowrap' } as React.CSSProperties,
};

export function TokenFamilyDoc() {
  const groups = ['max', 'primary', 'secondary', 'neutrals', 'brand', 'status'] as const;
  return (
    <div style={S.page}>
      <h1 style={S.h1}>text/ — FINAL · 21 tokens</h1>
      <p style={S.sub}>
        DS v2.3.2 semantic rebuild · decided 2026-07-11, pending formal lock. Two symmetric mono four-packs
        (pure extreme + brand voice), a secondary four-pack on the 70% alpha ladders, two field neutrals, the
        brand colours, three statuses. Every example renders on the token's real surface class —
        left panel light theme, right panel dark.
      </p>
      {groups.map((g) => (
        <React.Fragment key={g}>
          <p style={S.group}>{GROUP_META[g].title}</p>
          <p style={S.note}>{GROUP_META[g].note}</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Token</th>
                <th style={S.th}>Behavior</th>
                <th style={S.th}>Example (light · dark)</th>
                <th style={S.th}>Binding</th>
                <th style={S.th}>Light</th>
                <th style={S.th}>Dark</th>
              </tr>
            </thead>
            <tbody>
              {TEXT_FAMILY.filter((t) => t.group === g).map((t) => (
                <tr key={t.name}>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                    <span style={S.code}>{t.name}</span>
                  </td>
                  <td style={{ ...S.td, color: '#60646c', fontSize: 11.5, maxWidth: 260 }}>
                    <b style={{ fontWeight: 650 }}>{BEHAVIOR_LABEL[t.behavior]}</b> — {t.usage}
                  </td>
                  <td style={S.td}>
                    <ExamplePair t={t} />
                  </td>
                  <td style={{ ...S.td, whiteSpace: 'nowrap' }}>
                    <span style={S.code}>{t.binding}</span>
                  </td>
                  <td style={{ ...S.td, ...S.val }}>
                    {t.light}
                    {t.alpha ? ` @${Math.round(t.alpha * 100)}%` : ''}
                  </td>
                  <td style={{ ...S.td, ...S.val }}>
                    {t.dark}
                    {t.alpha ? ` @${Math.round(t.alpha * 100)}%` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </React.Fragment>
      ))}

      <p style={S.group}>adaptive text — one algorithm for images &amp; colour</p>
      <p style={S.note}>
        The unified law, computed live on this page (nothing hand-picked): <b>measure the surface, walk the
        preference-ordered candidates, first body-pass (4.5:1) wins.</b> On imagery the candidates are the
        max pair — sampled region luminance decides. On coloured surfaces the family speaks for itself first —
        own 12 dark voice, own 12 light voice — with neutral white/ink only as mid-tone fallback. Every caption
        below is the algorithm's own output with the measured ratio. Algorithm: <code style={S.code}>adaptive-text.ts</code> —
        the same function ships to the engine.
      </p>
      <AdaptiveTextDemo />

      <p style={S.group}>removed — {REMOVED.length} (all users re-pointed)</p>
      <p style={{ ...S.note, lineHeight: 1.8 }}>
        {REMOVED.map((r, i) => (
          <span key={r.name}>
            <span style={S.code}>{r.name.replace('text/', '')}</span> → {r.to.replace('text/', '')}
            {r.visible ? <b> ({r.visible})</b> : null}
            {i < REMOVED.length - 1 ? '  ·  ' : ''}
          </span>
        ))}
      </p>
    </div>
  );
}
