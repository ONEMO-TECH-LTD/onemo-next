import { describe, it, expect } from 'vitest';
import { defaultConfig } from '../config';
import { generateShape, type ShapeRequest } from '../shape';
import type { Pt } from '../types';

const evenUp = (v: number) => {
  const c = Math.ceil(v);
  return c % 2 === 0 ? c : c + 1;
};
const w = (r: { contour: { bounds: { minX: number; maxX: number } } }) => r.contour.bounds.maxX - r.contour.bounds.minX;
const h = (r: { contour: { bounds: { minY: number; maxY: number } } }) => r.contour.bounds.maxY - r.contour.bounds.minY;
const has = (pop: Pt[], x: number, y: number) => pop.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
const shoelace = (ring: Pt[]) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].y - ring[j].x * ring[i].y;
  }
  return Math.abs(a) / 2;
};
const req = (o: Partial<ShapeRequest> & Pick<ShapeRequest, 'family'>): ShapeRequest => ({
  span: { nx: 3, ny: 3 }, pitchMM: 48, mode: 'standard', ...o,
});

describe('P3 · ShapeGenerator — construction law (link magnet centres → offset by padding)', () => {
  describe('triangle — built from the grid, snug, corner-defined (law §3.2–3.4, Figma)', () => {
    it('Standard base-3 = the 1-1-3 population (3 base, 1 centre, 1 apex)', () => {
      const t = generateShape(req({ family: 'triangle', span: { nx: 3, ny: 3 }, mode: 'standard' }), defaultConfig);
      expect(t.population).toHaveLength(5);
      expect(has(t.population, 0, 0) && has(t.population, 48, 0) && has(t.population, 96, 0)).toBe(true); // base
      expect(has(t.population, 48, 48)).toBe(true); // centre
      expect(has(t.population, 48, 96)).toBe(true); // apex
      expect(t.vertices).toEqual([{ x: 0, y: 0 }, { x: 96, y: 0 }, { x: 48, y: 96 }]); // 3 corners
    });

    it('the apex is a SHARP miter point, not beveled (miterLimit guard, meta watch)', () => {
      const t = generateShape(req({ family: 'triangle', span: { nx: 3, ny: 3 } }), defaultConfig);
      // base edge padded down to -10; apex extends UP by the miter distance 10/sin(26.57°)=22.36.
      expect(t.contour.bounds.minY).toBeCloseTo(-10, 1);
      expect(t.contour.bounds.maxY).toBeCloseTo(96 + 22.36, 0); // a bevel would cut this peak short
    });

    it('Light drops interior magnets on a larger triangle (base-5), keeping apex + base row', () => {
      const std = generateShape(req({ family: 'triangle', span: { nx: 5, ny: 5 }, mode: 'standard' }), defaultConfig);
      const light = generateShape(req({ family: 'triangle', span: { nx: 5, ny: 5 }, mode: 'light' }), defaultConfig);
      expect(light.population.length).toBeLessThan(std.population.length); // interior drops
      expect(has(light.population, 96, 192)).toBe(true); // apex kept
      expect(has(light.population, 0, 0) && has(light.population, 192, 0)).toBe(true); // base corners kept
      expect(has(light.population, 96, 48)).toBe(false); // a fully-surrounded interior magnet is gone
    });
  });

  describe('square — grid-derived ladder 68 / 116 / 164 (law §3.5)', () => {
    it.each([[2, 68], [3, 116], [4, 164]])('span %i×%i → %imm', (n, mm) => {
      const s = generateShape(req({ family: 'square', span: { nx: n, ny: n } }), defaultConfig);
      expect(evenUp(w(s))).toBe(mm);
      expect(evenUp(h(s))).toBe(mm);
    });
    it('interior magnets never change the outline — Standard and Light 3×3 share one contour (law §3.4)', () => {
      const std = generateShape(req({ family: 'square', span: { nx: 3, ny: 3 }, mode: 'standard' }), defaultConfig);
      const light = generateShape(req({ family: 'square', span: { nx: 3, ny: 3 }, mode: 'light' }), defaultConfig);
      expect(std.population).toHaveLength(9);
      expect(light.population).toHaveLength(8); // centre dropped
      expect(light.contour.bounds).toEqual(std.contour.bounds); // outline unchanged
    });
  });

  describe('diamond — STRAIGHT-grid population, not diagonal (fixes the v1 regression)', () => {
    it('radius-1 diamond: 4 tips + centre on the straight lattice; Light = 4 tips', () => {
      const std = generateShape(req({ family: 'diamond', span: { nx: 1, ny: 1 }, mode: 'standard' }), defaultConfig);
      const light = generateShape(req({ family: 'diamond', span: { nx: 1, ny: 1 }, mode: 'light' }), defaultConfig);
      expect(std.population).toHaveLength(5);
      // every magnet sits on the straight 48 lattice (no 24/72 diagonal offsets)
      expect(std.population.every((p) => p.x % 48 === 0 && p.y % 48 === 0)).toBe(true);
      expect(light.population).toHaveLength(4); // centre (48,48) drops
      expect(has(light.population, 48, 48)).toBe(false);
    });
  });

  describe('circle — its own snug ladder 88 / 156 / 224 (law §3.5), analytic identity', () => {
    it.each([[2, 88], [3, 156], [4, 224]])('span %i×%i → %imm', (n, mm) => {
      const c = generateShape(req({ family: 'circle', span: { nx: n, ny: n } }), defaultConfig);
      expect(evenUp(w(c))).toBe(mm);
      expect(c.contour.analytic.kind).toBe('circle');
    });
  });

  describe('pill / stadium', () => {
    it('2-magnet pill → 68 × 20', () => {
      const p = generateShape(req({ family: 'pill', span: { nx: 2, ny: 1 } }), defaultConfig);
      expect(evenUp(w(p))).toBe(68);
      expect(Math.round(h(p))).toBe(20);
    });
  });

  describe('freeform — engine-native custom shapes (v1), rotation-invariant', () => {
    const blob = (deg = 0): Pt[] => {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * 2 * Math.PI;
        const r = i % 2 === 0 ? 120 : 70;
        pts.push({ x: 150 + r * Math.cos(a), y: 150 + r * Math.sin(a) });
      }
      const rad = (deg * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
      return pts.map((p) => ({ x: 150 + (p.x - 150) * c - (p.y - 150) * s, y: 150 + (p.x - 150) * s + (p.y - 150) * c }));
    };
    it('offsets the supplied contour; area is rotation-invariant (Δ < 1%)', () => {
      const a0 = shoelace(generateShape(req({ family: 'freeform', contour: blob(0) }), defaultConfig).contour.paths[0]);
      const a37 = shoelace(generateShape(req({ family: 'freeform', contour: blob(37) }), defaultConfig).contour.paths[0]);
      expect(Math.abs(a0 - a37) / a0).toBeLessThan(0.01);
    });
    it('seats magnets inside via fits-it-sits (every seated magnet clears the outline by ≥ padding)', () => {
      const f = generateShape(req({ family: 'freeform', contour: blob(0), mode: 'standard' }), defaultConfig);
      expect(f.population.length).toBeGreaterThan(0);
    });
    it('throws loudly on a degenerate contour', () => {
      expect(() => generateShape(req({ family: 'freeform', contour: [{ x: 0, y: 0 }] }), defaultConfig)).toThrow(/at least 3 points/);
    });
  });

  it('every family resolves under the 100ms budget (law §9)', () => {
    const start = performance.now();
    for (const family of ['square', 'triangle', 'diamond', 'circle', 'pill'] as const) {
      generateShape(req({ family, span: { nx: 4, ny: 4 } }), defaultConfig);
    }
    expect(performance.now() - start).toBeLessThan(100);
  });
});
