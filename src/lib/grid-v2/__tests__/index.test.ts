import { describe, it, expect } from 'vitest';
// Import ONLY from the sealed entry — exactly as a host (Shopify backend, admin bench) would.
import * as api from '../index';
import { solveGrid, solveLadder, defaultConfig, resolveConfig } from '../index';

describe('P5 · Sealed public API (law §10.1–10.2)', () => {
  describe('the seal — only the entry surface is exported, no internals leak', () => {
    it('exposes solveGrid / solveLadder + the config surface', () => {
      expect(typeof api.solveGrid).toBe('function');
      expect(typeof api.solveLadder).toBe('function');
      expect(typeof api.defaultConfig).toBe('object');
      expect(typeof api.resolveConfig).toBe('function');
      expect(typeof api.configHash).toBe('function');
    });
    it('does NOT re-export any engine internal (kills the v1 UI-logic-leak class)', () => {
      for (const internal of ['generateShape', 'generateGrid', 'offset', 'circle', 'boundaryRing', 'manufacturingSpec', 'sizeOf', 'magnetPlan']) {
        expect((api as Record<string, unknown>)[internal]).toBeUndefined();
      }
    });
  });

  describe('solveGrid — composes population + contour + size + mm spec', () => {
    it('a square 2×2 resolves to the 68mm base with a full spec', () => {
      const out = solveGrid({ family: 'square', span: { nx: 2, ny: 2 } });
      expect(out.sizeMM).toEqual({ widthMM: 68, heightMM: 68 });
      expect(out.spec.unit).toBe('mm');
      expect(out.spec.family).toBe('square');
      expect(out.population.length).toBeGreaterThan(0);
      expect(out.contour.analytic.kind).toBe('offset');
    });
    it('defaults mode to the product default (Light) — from config, not baked', () => {
      expect(defaultConfig.publication.defaultMode).toBe('light');
      const out = solveGrid({ family: 'square', span: { nx: 3, ny: 3 } });
      expect(out.population).toHaveLength(8); // Light ring of a 3×3
    });
    it('is source-blind and deterministic — same input → identical output (law §5.1)', () => {
      const a = solveGrid({ family: 'triangle', span: { nx: 3, ny: 3 } });
      const b = solveGrid({ family: 'triangle', span: { nx: 3, ny: 3 } });
      expect(a).toEqual(b);
    });
    it('admin config overrides flow through — smaller padding → smaller size, zero code edits', () => {
      const out = solveGrid({ family: 'square', span: { nx: 2, ny: 2 }, config: { padding: { radiusMM: 5 } } });
      expect(out.sizeMM.widthMM).toBe(58); // 48 + 2×5
    });
    it('the entire I/O is JSON-serializable (structured-clone safe, F1)', () => {
      const out = solveGrid({ family: 'circle', span: { nx: 3, ny: 3 } });
      expect(JSON.parse(JSON.stringify(out))).toEqual(out);
      expect(structuredClone(out)).toEqual(out);
    });
    it('resolves freeform (custom/AI) through the same entry', () => {
      const blob = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * 2 * Math.PI, r = i % 2 === 0 ? 120 : 70;
        return { x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) };
      });
      const out = solveGrid({ family: 'freeform', contour: blob, span: { nx: 1, ny: 1 } });
      expect(out.spec.unit).toBe('mm');
      expect(out.population.length).toBeGreaterThan(0);
    });
  });

  describe('solveLadder — the full tiered ladder', () => {
    it('square ladder climbs 68 → ceiling, sequential labels, no skips (law §3.7/§3.14)', () => {
      const rungs = solveLadder({ family: 'square', span: { nx: 2, ny: 2 } });
      expect(rungs[0].sizeMM).toBe(68);
      expect(rungs[0].label).toBe('S');
      expect(rungs.map((r) => r.label).slice(0, 3)).toEqual(['S', 'M', 'L']);
      // strictly ascending, every rung within the released ceiling
      for (let i = 1; i < rungs.length; i++) expect(rungs[i].sizeMM).toBeGreaterThan(rungs[i - 1].sizeMM);
      expect(rungs.every((r) => r.sizeMM <= defaultConfig.bounds.ceilingMM)).toBe(true);
    });
    it('circle ladder is its own 88 / 156 / 224 …', () => {
      const rungs = solveLadder({ family: 'circle', span: { nx: 2, ny: 2 } });
      expect(rungs.slice(0, 3).map((r) => r.sizeMM)).toEqual([88, 156, 224]);
    });
    it('a slider family (freeform) has no tier ladder — it throws (call solveGrid per size)', () => {
      expect(() => solveLadder({ family: 'freeform', span: { nx: 1, ny: 1 }, contour: [] })).toThrow(/slider/);
    });
    it('the ceiling is a config input — lowering it shortens the ladder', () => {
      const full = solveLadder({ family: 'square', span: { nx: 2, ny: 2 } });
      const capped = solveLadder({ family: 'square', span: { nx: 2, ny: 2 }, config: { bounds: { ceilingMM: 120 } } });
      expect(capped.length).toBeLessThan(full.length);
      expect(capped.every((r) => r.sizeMM <= 120)).toBe(true);
    });
  });

  describe('lawful spans — every skeleton vertex sits under a magnet (law §3.2)', () => {
    const key = (p: { x: number; y: number }) => `${Math.round(p.x)}:${Math.round(p.y)}`;
    it.each(['square', 'rectangle', 'triangle', 'diamond', 'circle', 'pill'] as const)(
      '%s ladder: every rung seats all of its skeleton vertices',
      (family) => {
        const rungs = solveLadder({ family, span: { nx: 3, ny: 3 } });
        expect(rungs.length).toBeGreaterThan(0);
        for (const rung of rungs) {
          const out = solveGrid({ family, span: rung.span });
          const pop = new Set(out.population.map(key));
          for (const v of out.vertices) expect(pop.has(key(v))).toBe(true);
        }
      },
    );
    it('the triangle ladder walks only odd bases (never the unlawful even-base apex)', () => {
      const rungs = solveLadder({ family: 'triangle', span: { nx: 3, ny: 3 } });
      expect(rungs.every((r) => r.span.nx % 2 === 1)).toBe(true);
    });
    it('an even-base triangle is rejected at the engine — fail loud, not a fitted template (§3.2)', () => {
      expect(() => solveGrid({ family: 'triangle', span: { nx: 2, ny: 2 } })).toThrow(/unlawful span/);
    });
  });
});
