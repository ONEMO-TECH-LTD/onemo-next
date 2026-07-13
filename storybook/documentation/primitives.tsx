'use client';

/**
 * Primitive-colour documentation renderers. Every swatch and label is read from the
 * generated snapshot at render time — components carry no colour values of their own.
 */

import React from 'react';
import { PRIM_COL, primitiveFamilies, ramp, resolve, childrenOf, cssColor, splitAlpha } from './data';
import { S, FamilyRamp, Swatch, ValueLabel, C, P } from './blocks';

/** All adaptive family ramps, both faces. */
export function AdaptiveFamilies() {
  const fams = primitiveFamilies();
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, margin: '2px 0 6px', flexWrap: 'wrap' }}>
        <span style={{ ...S.mono, color: '#8b8d98', minWidth: 120 }} />
        <span style={{ ...S.mono, color: '#8b8d98' }}>light theme →</span>
        <span style={{ ...S.mono, color: '#8b8d98', marginLeft: 'auto' }}>dark theme →</span>
      </div>
      {fams.map((f) => (
        <FamilyRamp key={f} name={f} steps={ramp(PRIM_COL, f)} />
      ))}
    </div>
  );
}

/** Base tones: singles with their two faces. */
export function BaseTones() {
  const names = childrenOf(PRIM_COL, 'base');
  return (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', margin: '8px 0' }}>
      {names.map((n) => {
        const r = resolve(PRIM_COL, `base/${n}`);
        if (!r) return null;
        return (
          <div key={n} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              <Swatch value={r.L} size={34} />
              <Swatch value={r.D} size={34} />
            </div>
            <div style={{ ...S.mono, fontSize: 9.5, color: '#60646c', marginTop: 3 }}>base/{n}</div>
            <div style={{ ...S.mono, fontSize: 9, color: '#8b8d98' }}>
              <ValueLabel value={r.L} /> · <ValueLabel value={r.D} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One behavior group rendered for an exemplar family, with optional face labels. */
export function BehaviorRamp({ group, family }: { group: string; family: string }) {
  const steps = ramp(PRIM_COL, `${group}/${family}`);
  if (!steps.length) return <P>—</P>;
  return <FamilyRamp name={`${group}/${family}`} steps={steps} />;
}

/**
 * The twin proof: each pill is half solid step, half alpha twin composited on the
 * page ground — a seam would reveal any mismatch. Rendered live from the data.
 */
export function TwinProof({ family }: { family: string }) {
  const solid = ramp(PRIM_COL, family);
  const alpha = ramp(PRIM_COL, `alpha/${family}`);
  if (!solid.length || !alpha.length) return null;
  return (
    <div>
      {(['L', 'D'] as const).map((face) => (
        <div
          key={face}
          style={{
            display: 'flex',
            gap: 4,
            padding: 10,
            borderRadius: 10,
            background: face === 'L' ? '#ffffff' : '#000000',
            border: '1px solid rgba(128,128,128,.25)',
            margin: '6px 0',
            width: 'fit-content',
          }}
        >
          {solid.map((s, i) => (
            <span key={s.step} style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }}>
              <span style={{ width: 15, height: 26, background: cssColor(face === 'L' ? s.L : s.D) }} />
              <span
                style={{
                  width: 15,
                  height: 26,
                  background: cssColor(face === 'L' ? alpha[i].L : alpha[i].D),
                }}
              />
            </span>
          ))}
          <span style={{ ...S.mono, color: face === 'L' ? '#60646c' : '#b0b4ba', alignSelf: 'center', marginLeft: 6 }}>
            solid|twin ×12
          </span>
        </div>
      ))}
    </div>
  );
}

/** Anchored counting: the light-anchored and dark-anchored ramps of one family, both faces. */
export function AnchorDemo({ family }: { family: string }) {
  return (
    <div>
      <BehaviorRamp group="constant" family={family} />
      <BehaviorRamp group="inverse-constant" family={family} />
      <P>
        <C>constant</C> pins each step's own reading; <C>inverse-constant</C> pins the swapped reading — the
        same identity read from the opposite world. Pins add no new colour decisions; they change whether
        a step follows the theme.
      </P>
    </div>
  );
}

/** Inverse: adaptive vs inverse ramp of one family — the faces swap. */
export function InverseDemo({ family }: { family: string }) {
  return (
    <div>
      <FamilyRamp name={family} steps={ramp(PRIM_COL, family)} />
      <FamilyRamp name={`inverse/${family}`} steps={ramp(PRIM_COL, `inverse/${family}`)} />
    </div>
  );
}

/** The opacity ladder of one alpha family, labels computed from the data. */
export function AlphaLadder({ path }: { path: string }) {
  const steps = ramp(PRIM_COL, path);
  if (!steps.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
      {steps.map((s) => {
        const { alpha } = splitAlpha(s.L);
        return (
          <div key={s.step} style={{ textAlign: 'center' }}>
            <Swatch value={s.L} size={28} />
            <div style={{ ...S.mono, fontSize: 8.5, color: '#8b8d98', marginTop: 1 }}>
              {alpha !== null ? `${Math.round(alpha * 100)}%` : '—'}
            </div>
          </div>
        );
      })}
      <code style={{ ...S.code, alignSelf: 'center' }}>{path}</code>
    </div>
  );
}
