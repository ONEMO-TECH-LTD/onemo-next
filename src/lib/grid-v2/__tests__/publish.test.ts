import { describe, it, expect } from 'vitest';
import { defaultConfig, resolveConfig } from '../config';
import { generateShape } from '../shape';
import {
  sizeOf, applyFrame, magnetPlan, attachmentSupport, publicationChannel,
  oneOffered, snapUp, modeSwitchNeverShrinks, catalogueLadder, labelAt, manufacturingSpec,
} from '../publish';

const square = (n: number, mode: 'standard' | 'light' = 'standard') =>
  generateShape({ family: 'square', span: { nx: n, ny: n }, pitchMM: 48, mode }, defaultConfig);

describe('P4 · Publication + mm manufacturing spec', () => {
  describe('even-mm size, frameless (law §3.4, §8.1, §2.3)', () => {
    it('sizeOf rounds the contour up to the even millimetre — square 2×2 → 68', () => {
      expect(sizeOf(square(2).contour, defaultConfig)).toEqual({ widthMM: 68, heightMM: 68 });
    });
    it('frame is a separate additive buffer — frame-off = true base, frame-on adds a measured band', () => {
      const base = sizeOf(square(2).contour, defaultConfig);
      expect(applyFrame(base, 0)).toEqual(base); // frame off = true base (§2.3)
      expect(applyFrame(base, 2)).toEqual({ widthMM: 72, heightMM: 72 }); // +2mm each side
    });
    it('the released frame default is 0 (never a hidden baked-in band)', () => {
      expect(defaultConfig.frame.defaultMM).toBe(0);
    });
  });

  describe('focal-8 magnet plan (law §5.7, F5)', () => {
    it('square 3×3: the 4 hull corners get 8mm, the rest 6mm — never all-8', () => {
      const s = square(3);
      const plan = magnetPlan(s.population, defaultConfig);
      expect(plan).toHaveLength(9);
      expect(plan.filter((m) => m.diameterMM === 8)).toHaveLength(4); // hull corners = radial extremes
      expect(plan.filter((m) => m.diameterMM === 6)).toHaveLength(5); // interior + edges
      expect(plan.some((m) => m.diameterMM === 6)).toBe(true); // never all-8
    });
    it('freeform ships real 8mm magnets — extremes come from the population, not lattice-miss vertices', () => {
      const blob = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * 2 * Math.PI, r = i % 2 === 0 ? 120 : 70;
        return { x: 200 + r * Math.cos(a), y: 200 + r * Math.sin(a) };
      });
      const f = generateShape({ family: 'freeform', span: { nx: 1, ny: 1 }, pitchMM: 48, mode: 'standard', contour: blob }, defaultConfig);
      const plan = magnetPlan(f.population, defaultConfig);
      expect(plan.some((m) => m.diameterMM === 8)).toBe(true); // never all-6 (the v1-style zero-8 bug)
      expect(plan.some((m) => m.diameterMM === 6)).toBe(true); // never all-8
    });
    it('is config-tuned — changing the hardware set re-derives the plan', () => {
      const plan = magnetPlan(square(3).population, resolveConfig({ magnets: { extremeMM: 10, interiorMM: 5 } }));
      expect(plan.filter((m) => m.diameterMM === 10)).toHaveLength(4);
      expect(plan.filter((m) => m.diameterMM === 5)).toHaveLength(5);
    });
  });

  describe('publication behaviours (F7) + attachment filter (F12)', () => {
    it('attachment↔grid: magnetic holds on 48-straight & 96-dice, never 96-straight (law §5.1a)', () => {
      expect(attachmentSupport('magnetic', defaultConfig)).toEqual(['48-straight', '96-dice']);
      expect(attachmentSupport('magnetic', defaultConfig)).not.toContain('96-straight');
      expect(attachmentSupport('twin-fix', defaultConfig)).toContain('96-straight');
    });
    it('standard shapes get tiers; generator/AI (freeform) gets a slider (law §3.14)', () => {
      expect(publicationChannel('square', defaultConfig)).toBe('tiers');
      expect(publicationChannel('freeform', defaultConfig)).toBe('slider');
    });
    it('ONE is carried and offered by a released rule, not baked (law §8.3)', () => {
      expect(oneOffered(defaultConfig)).toBe(true);
      expect(oneOffered(resolveConfig({ publication: { offerONE: false } }))).toBe(false);
    });
    it('snapping advances upward to the next rung, never the nearest (law §3.15)', () => {
      expect(snapUp(70, [68, 116, 164])).toBe(116); // 70 is above 68 → next rung up, not nearest (68)
      expect(snapUp(68, [68, 116, 164])).toBe(68);
    });
    it('an oversize request fails loudly — never silently snaps DOWN (law §4.11)', () => {
      expect(() => snapUp(400, [68, 116])).toThrow(/oversize/); // 400 > 116 → no downward shrink
    });
    it('a mode switch never silently shrinks (law §4.11)', () => {
      const std = sizeOf(square(3, 'standard').contour, defaultConfig);
      const light = sizeOf(square(3, 'light').contour, defaultConfig);
      expect(modeSwitchNeverShrinks(std, light)).toBe(true); // same contour → never shrinks
      expect(modeSwitchNeverShrinks({ widthMM: 116, heightMM: 116 }, { widthMM: 100, heightMM: 116 })).toBe(false);
    });
    it('the ladder never skips a size and labels are sequential (law §3.7, §3.9)', () => {
      const rungs = catalogueLadder([164, 68, 116, 68]); // unsorted + a duplicate
      expect(rungs.map((r) => r.sizeMM)).toEqual([68, 116, 164]); // sorted, de-duped, none dropped
      expect(rungs.map((r) => r.label)).toEqual(['S', 'M', 'L']); // sequential
      expect(labelAt(4)).toBe('2XL');
    });
  });

  describe('mm manufacturing spec emitter (law §9.3–9.7, F5/F6)', () => {
    it('emits the full spec — analytic identity, per-magnet plan, frameless base + frame', () => {
      const s = square(3);
      const spec = manufacturingSpec(s, defaultConfig);
      expect(spec.unit).toBe('mm');
      expect(spec.family).toBe('square');
      expect(spec.bboxMM).toEqual({ widthMM: 116, heightMM: 116 }); // frameless base
      expect(spec.framedBboxMM).toEqual({ widthMM: 116, heightMM: 116 }); // frame default 0
      expect(spec.frameMM).toBe(0);
      expect(spec.paddingMM).toBe(10);
      expect(spec.magnetPlan).toHaveLength(9);
      expect(spec.paths).toBe(s.contour.paths); // carries the resolved contour (holes flow through)
      expect(spec.areaMM2).toBeGreaterThan(0);
      expect(spec.attachment).toEqual({ mode: 'magnetic', compatibleLayouts: ['48-straight', '96-dice'] });
    });
    it('a circle spec carries the analytic circle, not just the tessellation (law §9.2a, F6)', () => {
      const c = generateShape({ family: 'circle', span: { nx: 2, ny: 2 }, pitchMM: 48, mode: 'standard' }, defaultConfig);
      const spec = manufacturingSpec(c, defaultConfig);
      expect(spec.analytic.kind).toBe('circle');
    });
    it('resolves under the 1ms budget', () => {
      const s = square(4);
      const start = performance.now();
      for (let i = 0; i < 1000; i++) manufacturingSpec(s, defaultConfig);
      expect((performance.now() - start) / 1000).toBeLessThan(1);
    });
  });
});
