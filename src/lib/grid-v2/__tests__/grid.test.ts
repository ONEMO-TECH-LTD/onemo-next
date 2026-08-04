import { describe, it, expect } from 'vitest';
import { defaultConfig, resolveConfig } from '../config';
import { generateGrid, boundaryRing, neighbourVectors, extremeVertices } from '../grid';
import type { GridRequest } from '../types';

const P = 48; // base pitch, from config — used only to express expectations in the test
const req = (over: Partial<GridRequest>): GridRequest => ({
  span: { nx: 3, ny: 3 }, pitchMM: P, pattern: 'straight', mode: 'standard', ...over,
});

describe('P1 · GridGenerator — population + mode mask (law §3.1, §4.1)', () => {
  describe('straight lattice + the Light boundary-ring ladder (law §4.1 — reproduces 4/8/12)', () => {
    it('2×2: Standard = 4, Light = 4 (the ring is the whole population at the smallest size)', () => {
      expect(generateGrid(req({ span: { nx: 2, ny: 2 }, mode: 'standard' }), defaultConfig).population).toHaveLength(4);
      expect(generateGrid(req({ span: { nx: 2, ny: 2 }, mode: 'light' }), defaultConfig).population).toHaveLength(4);
    });
    it('3×3: Standard = 9, Light = 8 (centre magnet — the one fully-surrounded node — drops)', () => {
      expect(generateGrid(req({ span: { nx: 3, ny: 3 }, mode: 'standard' }), defaultConfig).population).toHaveLength(9);
      expect(generateGrid(req({ span: { nx: 3, ny: 3 }, mode: 'light' }), defaultConfig).population).toHaveLength(8);
    });
    it('4×4: Standard = 16, Light = 12 (the inner 2×2 drops)', () => {
      expect(generateGrid(req({ span: { nx: 4, ny: 4 }, mode: 'standard' }), defaultConfig).population).toHaveLength(16);
      expect(generateGrid(req({ span: { nx: 4, ny: 4 }, mode: 'light' }), defaultConfig).population).toHaveLength(12);
    });
    it('Light keeps every perimeter magnet on the physical boundary — none in the interior', () => {
      const { population } = generateGrid(req({ span: { nx: 4, ny: 4 }, mode: 'light' }), defaultConfig);
      const onBoundary = (p: { x: number; y: number }) =>
        p.x === 0 || p.y === 0 || p.x === 3 * P || p.y === 3 * P;
      expect(population.every(onBoundary)).toBe(true);
    });
  });

  describe('diamond — checkerboard subset, diagonal 48·√2 adjacency (law §4.3a)', () => {
    it('3×3: Standard = 5 (checkerboard), Light = 4 (centre drops)', () => {
      expect(generateGrid(req({ span: { nx: 3, ny: 3 }, pattern: 'diamond', mode: 'standard' }), defaultConfig).population).toHaveLength(5);
      expect(generateGrid(req({ span: { nx: 3, ny: 3 }, pattern: 'diamond', mode: 'light' }), defaultConfig).population).toHaveLength(4);
    });
  });

  describe('dice/quincunx — grid + cell centres, legal ONLY at 96 (law §4.3a)', () => {
    it('3×3 @96: Standard = 13 (9 grid + 4 centres)', () => {
      expect(generateGrid({ span: { nx: 3, ny: 3 }, pitchMM: 96, pattern: 'dice', mode: 'standard' }, defaultConfig).population).toHaveLength(13);
    });
    it('centres land exactly on 48-offsets (48,48)…', () => {
      const { population } = generateGrid({ span: { nx: 2, ny: 2 }, pitchMM: 96, pattern: 'dice', mode: 'standard' }, defaultConfig);
      expect(population).toContainEqual({ x: 48, y: 48 });
    });
    it('dice at 48 is illegal and throws loudly (centres would land at 24mm — law §1.3/§4.3a)', () => {
      expect(() => generateGrid({ span: { nx: 3, ny: 3 }, pitchMM: 48, pattern: 'dice', mode: 'standard' }, defaultConfig)).toThrow(/legal only at pitch 96/);
    });
  });

  describe('vertices — the shape-defining magnets', () => {
    it('a 3×3 straight block names its 4 corner magnets, mode-independent', () => {
      const std = generateGrid(req({ span: { nx: 3, ny: 3 }, mode: 'standard' }), defaultConfig);
      const light = generateGrid(req({ span: { nx: 3, ny: 3 }, mode: 'light' }), defaultConfig);
      expect(std.vertices).toHaveLength(4);
      expect(std.vertices).toEqual(light.vertices);
      expect(std.vertices).toEqual(
        expect.arrayContaining([
          { x: 0, y: 0 }, { x: 2 * P, y: 0 }, { x: 0, y: 2 * P }, { x: 2 * P, y: 2 * P },
        ]),
      );
    });
  });

  describe('neutrality, validation & config-driven values', () => {
    it('is deterministic and source-blind — identical request → identical output (law §5.1)', () => {
      const a = generateGrid(req({}), defaultConfig);
      const b = generateGrid(req({}), defaultConfig);
      expect(a).toEqual(b);
    });
    it('rejects a pitch outside the released set (law §1.1)', () => {
      expect(() => generateGrid(req({ pitchMM: 50 }), defaultConfig)).toThrow(/not in the released pitch set/);
    });
    it('rejects a span below 1×1', () => {
      expect(() => generateGrid(req({ span: { nx: 0, ny: 3 } }), defaultConfig)).toThrow(/at least 1×1/);
    });
    it('honours a config that removes a pitch tier (every value is an input)', () => {
      const only48 = resolveConfig({ lattice: { pitchSetMM: [48] } });
      expect(() => generateGrid(req({ pitchMM: 96 }), only48)).toThrow(/not in the released pitch set/);
    });
  });

  describe('reused primitives', () => {
    it('boundaryRing is shape-agnostic — a thin 1×3 strip is all-perimeter', () => {
      const strip = [{ x: 0, y: 0 }, { x: P, y: 0 }, { x: 2 * P, y: 0 }];
      expect(boundaryRing(strip, 'straight', P)).toHaveLength(3);
    });
    it('neighbourVectors returns 4 offsets per pattern', () => {
      for (const pat of ['straight', 'diamond', 'dice'] as const) {
        expect(neighbourVectors(pat, P)).toHaveLength(4);
      }
    });
    it('extremeVertices of a single point is that point', () => {
      expect(extremeVertices([{ x: 5, y: 5 }])).toEqual([{ x: 5, y: 5 }]);
    });
  });

  it('resolves fast (<1ms) for a full 6×6 population', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) generateGrid(req({ span: { nx: 6, ny: 6 }, mode: 'light' }), defaultConfig);
    expect((performance.now() - start) / 200).toBeLessThan(1);
  });
});
