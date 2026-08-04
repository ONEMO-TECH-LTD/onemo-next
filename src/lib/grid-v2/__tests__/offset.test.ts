import { describe, it, expect } from 'vitest';
import { defaultConfig, resolveConfig } from '../config';
import { offset, circle } from '../offset';
import type { Pt } from '../types';

const evenUp = (v: number) => {
  const c = Math.ceil(v);
  return c % 2 === 0 ? c : c + 1;
};
const width = (b: { minX: number; maxX: number }) => b.maxX - b.minX;
const height = (b: { minY: number; maxY: number }) => b.maxY - b.minY;
const shoelace = (ring: Pt[]) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
};
// The AI/blob class — a concave organic outline (from the proven probe).
const blob = (scale = 1): Pt[] => {
  const pts: Pt[] = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const r = (i % 2 === 0 ? 60 : 30) * scale;
    pts.push({ x: 80 + r * Math.cos(a), y: 80 + r * Math.sin(a) });
  }
  return pts;
};
const rot = (pts: Pt[], deg: number): Pt[] => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), cx = 80, cy = 80;
  return pts.map((p) => ({ x: cx + (p.x - cx) * c - (p.y - cy) * s, y: cy + (p.x - cx) * s + (p.y - cy) * c }));
};

describe('P2 · Offset adapter — the clipper seam (law §3.3, §9.2)', () => {
  it('square 2×2 @48 miter → 68 (the worked anchor, law §3.5)', () => {
    const c = offset([{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 48 }, { x: 0, y: 48 }], 10, 'miter', true, defaultConfig);
    expect(evenUp(width(c.bounds))).toBe(68);
    expect(evenUp(height(c.bounds))).toBe(68);
  });

  it('circle 2×2 → 88 (circumradius 33.94 + padding 10, law §3.5)', () => {
    const rad = Math.hypot(24, 24) + 10; // 43.94
    const c = circle({ x: 24, y: 24 }, rad, defaultConfig);
    expect(evenUp(width(c.bounds))).toBe(88);
    expect(Math.abs(width(c.bounds) - 2 * rad)).toBeLessThan(0.5);
  });

  it('pill / stadium — open 2-magnet axis 48 apart, round ends → 68 × 20', () => {
    const c = offset([{ x: 0, y: 0 }, { x: 48, y: 0 }], 10, 'round', false, defaultConfig);
    expect(evenUp(width(c.bounds))).toBe(68);
    expect(Math.round(height(c.bounds))).toBe(20);
  });

  it('triangle — 3-corner miter offset wraps the corners snug (Dan frame 15.03.47)', () => {
    const tri: Pt[] = [{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 48, y: 83.14 }];
    const c = offset(tri, 10, 'miter', true, defaultConfig);
    // The offset outline is strictly larger than the corner triangle on every side.
    expect(width(c.bounds)).toBeGreaterThan(96);
    expect(height(c.bounds)).toBeGreaterThan(83);
    expect(c.bounds.minX).toBeLessThan(0); // padded outward past the corners
  });

  it('custom blob (AI class) — rotation-invariant area (Δ < 1%)', () => {
    const a0 = shoelace(offset(blob(), 10, 'round', true, defaultConfig).paths[0]);
    const a37 = shoelace(offset(rot(blob(), 37), 10, 'round', true, defaultConfig).paths[0]);
    expect(Math.abs(a0 - a37) / a0).toBeLessThan(0.01);
  });

  it('polygon WITH HOLE — the hole is preserved (outer + inner rings out)', () => {
    const outer: Pt[] = [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }];
    const hole: Pt[] = [{ x: 40, y: 40 }, { x: 40, y: 80 }, { x: 80, y: 80 }, { x: 80, y: 40 }];
    const c = offset([outer, hole], 10, 'miter', true, defaultConfig);
    expect(c.paths.length).toBeGreaterThanOrEqual(2);
  });

  describe('analytic identity is the truth; tessellation is only a budget (law §9.2a/b, F6)', () => {
    it('circle carries its exact analytic radius, independent of the polygon step count', () => {
      const rad = 43.94;
      const coarse = circle({ x: 0, y: 0 }, rad, resolveConfig({ tessellation: { circleSteps: 24 } }));
      const fine = circle({ x: 0, y: 0 }, rad, resolveConfig({ tessellation: { circleSteps: 720 } }));
      // The tessellation budget changes the point count…
      expect(fine.paths[0].length).toBeGreaterThan(coarse.paths[0].length);
      // …but the analytic radius — the product truth — is identical and exact.
      expect(coarse.analytic).toEqual({ kind: 'circle', centre: { x: 0, y: 0 }, radiusMM: rad });
      expect(fine.analytic).toEqual({ kind: 'circle', centre: { x: 0, y: 0 }, radiusMM: rad });
    });
    it('an offset polygon carries its skeleton + padding + join so it can be re-derived', () => {
      const tri: Pt[] = [{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 48, y: 83.14 }];
      const c = offset(tri, 10, 'miter', true, defaultConfig);
      expect(c.analytic).toEqual({ kind: 'offset', rings: [tri], paddingMM: 10, join: 'miter', closed: true });
    });
  });

  it('a full ladder of 60 offsets resolves well under the 100ms/solve budget (law §9)', () => {
    const start = performance.now();
    for (let n = 1; n <= 60; n++) {
      const s = 48 * n;
      offset([{ x: 0, y: 0 }, { x: s, y: 0 }, { x: s, y: s }, { x: 0, y: s }], 10, 'miter', true, defaultConfig);
    }
    const total = performance.now() - start;
    expect(total / 60).toBeLessThan(100);
  });
});
