'use client';

/**
 * Accessible-text documentation renderers: the unified pick algorithm demonstrated
 * live. Every caption is the algorithm's own output over the generated data.
 */

import React from 'react';
import { relLuminance, pickOnColour, FAMILY_RAMPS } from '../design-system/tokens/adaptive-text';
import { S } from './blocks';

/** Imagery stand-ins, dark → light (scenery for the demo, not tokens). */
const IMAGE_SWEEP: { stops: [string, string]; label: string }[] = [
  { stops: ['#0b0e11', '#20262c'], label: 'night' },
  { stops: ['#1f2f28', '#3a6b52'], label: 'deep green' },
  { stops: ['#b0592f', '#3a6b52'], label: 'mid photo' },
  { stops: ['#e8b04b', '#b0592f'], label: 'warm mid' },
  { stops: ['#d9cfc0', '#b8a88f'], label: 'light textile' },
  { stops: ['#f6f2ec', '#e9e4da'], label: 'white product' },
];

const caption: React.CSSProperties = { ...S.mono, fontSize: 9.5, color: '#8b8d98', marginTop: 3 };

export function ImagePickDemo() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {IMAGE_SWEEP.map((img) => {
        const luma = (relLuminance(img.stops[0]) + relLuminance(img.stops[1])) / 2;
        const white = luma < 0.4;
        return (
          <div key={img.label} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 124,
                height: 58,
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
            <div style={caption}>
              luma {luma.toFixed(2)} → max-{white ? 'light' : 'dark'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ColourPickDemo() {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
      {Object.keys(FAMILY_RAMPS).flatMap((fam) =>
        (['3', '9'] as const).map((step) => {
          const surface = FAMILY_RAMPS[fam].steps[step].L;
          const pick = pickOnColour(fam, surface);
          return (
            <div key={fam + step} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 124,
                  height: 58,
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
              <div style={caption}>
                {fam}/{step} → {pick.token.replace(fam + '/', 'own ').replace(' voice)', ')')}
              </div>
              <div style={caption}>
                {pick.ratio.toFixed(2)} {pick.body ? '✓ body' : '△ large-only'}
              </div>
            </div>
          );
        }),
      )}
    </div>
  );
}
