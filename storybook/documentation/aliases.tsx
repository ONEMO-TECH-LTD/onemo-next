'use client';

/**
 * Alias-tier documentation renderers — the product palette, colour-first.
 * All swatches resolve through the alias collection at render time.
 */

import React from 'react';
import { AL_COL, ramp, resolve, childrenOf } from './data';
import { S, FamilyRamp, Swatch, C } from './blocks';

/** The palette's bare (adaptive solid) ramps and singles, per top-level group. */
export function PaletteGroup({ group }: { group: string }) {
  const kids = childrenOf(AL_COL, group);
  const rows: React.ReactNode[] = [];
  // ramp directly under the group (statuses, neutral)
  const direct = ramp(AL_COL, group);
  if (direct.length === 12) rows.push(<FamilyRamp key={group} name={group} steps={direct} />);
  for (const k of kids) {
    if (/^\d+$/.test(k)) {
      const steps = ramp(AL_COL, `${group}/${k}`);
      if (steps.length === 12) rows.push(<FamilyRamp key={k} name={`${group}/${k}`} steps={steps} />);
    } else if (!isBehavior(k)) {
      const r = resolve(AL_COL, `${group}/${k}`);
      if (r)
        rows.push(
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '7px 0' }}>
            <code style={{ ...S.code, minWidth: 120 }}>
              {group}/{k}
            </code>
            <Swatch value={r.L} size={30} />
            <Swatch value={r.D} size={30} />
          </div>,
        );
    }
  }
  return <div>{rows}</div>;
}

const BEHAVIORS = ['alpha', 'constant', 'constant-alpha', 'inverse', 'inverse-constant', 'inverse-constant-alpha'];
function isBehavior(k: string) {
  return BEHAVIORS.includes(k);
}

/** One colour's full behavior anatomy: bare + each qualifier, rendered as ramps. */
export function ColourAnatomy({ path }: { path: string }) {
  const bare = ramp(AL_COL, path);
  return (
    <div>
      {bare.length === 12 ? <FamilyRamp name={path} steps={bare} /> : null}
      {BEHAVIORS.map((b) => {
        const steps = ramp(AL_COL, `${path}/${b}`);
        if (steps.length !== 12) return null;
        return <FamilyRamp key={b} name={`${path}/${b}`} steps={steps} />;
      })}
    </div>
  );
}

/** The pair with its behavior variants, singles-shaped. */
export function PairAnatomy({ group }: { group: string }) {
  const tones = childrenOf(AL_COL, group).filter((k) => !/^\d+$/.test(k) && !isBehavior(k));
  return (
    <div>
      {tones.map((tone) => {
        const base = resolve(AL_COL, `${group}/${tone}`);
        if (!base) return null;
        return (
          <div key={tone} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '7px 0', flexWrap: 'wrap' }}>
            <code style={{ ...S.code, minWidth: 120 }}>
              {group}/{tone}
            </code>
            <Swatch value={base.L} size={28} />
            <Swatch value={base.D} size={28} />
            {BEHAVIORS.map((b) => {
              const kids = childrenOf(AL_COL, `${group}/${tone}/${b}`);
              if (!kids.length) return null;
              return (
                <span key={b} style={{ ...S.mono, color: '#8b8d98' }}>
                  ·{b}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
