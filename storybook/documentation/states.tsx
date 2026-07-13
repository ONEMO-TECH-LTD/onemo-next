'use client';

/**
 * States & interaction renderers. Wash intensities are never typed here — each demo
 * resolves its alias route from the generated data and computes the opacity label.
 */

import React from 'react';
import { AL_COL, resolve, cssColor, splitAlpha } from './data';
import { S } from './blocks';

const PHOTO = 'linear-gradient(135deg,#e8b04b 0%,#b0592f 45%,#3a6b52 100%)'; // imagery stand-in

/** A surface row: rest + one chip per wash route, split half-rest/half-washed. */
function WashRow({
  label,
  ground,
  face,
  routes,
}: {
  label: string;
  ground: string; // css background for the control
  face: 'L' | 'D';
  routes: { name: string; path: string }[];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0', flexWrap: 'wrap' }}>
      <span style={{ ...S.mono, width: 150, color: '#60646c' }}>{label}</span>
      <Chip ground={ground} />
      {routes.map((r) => {
        const v = resolve(AL_COL, r.path);
        if (!v) return null;
        const raw = face === 'L' ? v.L : v.D;
        const { alpha } = splitAlpha(raw);
        return (
          <div key={r.name} style={{ textAlign: 'center' }}>
            <Chip ground={ground} wash={cssColor(raw)} />
            <div style={{ ...S.mono, fontSize: 8.5, color: '#8b8d98', marginTop: 1 }}>
              {r.name}
              {alpha !== null ? ` ${Math.round(alpha * 100)}%` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Chip({ ground, wash }: { ground: string; wash?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 104,
        height: 46,
        borderRadius: 12,
        background: ground,
        border: '1px solid rgba(128,128,128,.25)',
        position: 'relative',
        overflow: 'hidden',
        verticalAlign: 'middle',
      }}
    >
      {wash ? (
        <span style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '50%', background: wash }} />
      ) : null}
    </span>
  );
}

/** The washes on the three surface classes — each chip half rest, half washed. */
export function WashDemo() {
  const light = resolve(AL_COL, 'neutral/3');
  const inkPill = resolve(AL_COL, 'brand/ink-snow');
  return (
    <div>
      <p style={{ ...S.mono, fontSize: 9.5, color: '#8b8d98' }}>
        each chip: left half rest · right half washed — the seam is the state change
      </p>
      <WashRow
        label="on light surfaces"
        ground={light ? cssColor(light.L) : '#eee'}
        face="L"
        routes={[
          { name: 'hover', path: 'brand/ink-snow-alpha/1' },
          { name: 'press', path: 'brand/ink-snow-alpha/2' },
          { name: 'drag', path: 'brand/ink-snow-alpha/3' },
        ]}
      />
      <WashRow
        label="on solid / dark fills"
        ground={inkPill ? cssColor(inkPill.L) : '#000'}
        face="L"
        routes={[
          { name: 'hover', path: 'brand/snow-ink-alpha/1' },
          { name: 'press', path: 'brand/snow-ink-alpha/2' },
          { name: 'drag', path: 'brand/snow-ink-alpha/3' },
        ]}
      />
      <WashRow
        label="on imagery (never flips)"
        ground={PHOTO}
        face="L"
        routes={[
          { name: 'hover', path: 'base/black-constant-alpha/1' },
          { name: 'press', path: 'base/black-constant-alpha/2' },
          { name: 'drag', path: 'base/black-constant-alpha/3' },
        ]}
      />
    </div>
  );
}

/** Scrims over imagery, opacity computed from the route. */
export function ScrimDemo() {
  const routes = [
    { name: 'scrim over imagery (text legibility)', path: 'base/black-constant-alpha/5' },
    { name: 'scrim behind modals', path: 'base/black-constant-alpha/8' },
  ];
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
      {routes.map((r) => {
        const v = resolve(AL_COL, r.path);
        if (!v) return null;
        const { alpha } = splitAlpha(v.L);
        return (
          <div key={r.name} style={{ textAlign: 'center' }}>
            <span
              style={{
                display: 'inline-block',
                width: 150,
                height: 64,
                borderRadius: 12,
                background: PHOTO,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{ position: 'absolute', inset: 0, background: cssColor(v.L) }} />
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 650,
                }}
              >
                Ag
              </span>
            </span>
            <div style={{ ...S.mono, fontSize: 9, color: '#8b8d98', marginTop: 2 }}>
              {r.name}
              {alpha !== null ? ` · ${Math.round(alpha * 100)}%` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
