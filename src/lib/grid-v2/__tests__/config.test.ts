import { describe, it, expect } from 'vitest';
import {
  defaultConfig,
  resolveConfig,
  configHash,
  type EngineConfig,
} from '../config';

describe('P0 · EngineConfig — released inputs as data (law §7, §10.6)', () => {
  it('loads the released config with the current focal values', () => {
    // These are the law's released values — they live in config.data.json, nowhere else.
    expect(defaultConfig.lattice.basePitchMM).toBe(48); // law §1.1
    expect(defaultConfig.lattice.pitchSetMM).toEqual([48, 96]);
    expect(defaultConfig.padding.radiusMM).toBe(10); // law §2.2
    expect(defaultConfig.padding.marginAllowanceMM).toBe(12); // v1 §2.7
    expect(defaultConfig.frame.defaultMM).toBe(0); // frame off = true base (law §2.3)
    expect(defaultConfig.rounding.quantumMM).toBe(2); // even-mm (law §3.4)
    expect(defaultConfig.bounds.ceilingMM).toBe(310); // law §11.2
    expect(defaultConfig.magnets.setMM).toEqual([6, 8]); // law §11.1
    expect(defaultConfig.magnets.extremeMM).toBe(8); // focal-8 (law §5.7)
    expect(defaultConfig.patterns.default).toBe('straight'); // law §1.2
    expect(defaultConfig.patterns.dicePitchMM).toBe(96); // dice legal only at 96 (law §4.3a)
    expect(defaultConfig.publication.defaultMode).toBe('light'); // Light is the product default (law §4.3)
  });

  it('encodes the attachment↔grid compatibility law (§5.1a)', () => {
    // magnetic holds on 48-straight OR 96-dice — NOT 96-straight.
    expect(defaultConfig.attachment.compatibility.magnetic).toEqual(['48-straight', '96-dice']);
    expect(defaultConfig.attachment.compatibility.magnetic).not.toContain('96-straight');
    // twin-fix is free of the garment grid.
    expect(defaultConfig.attachment.compatibility['twin-fix']).toContain('96-straight');
    expect(defaultConfig.attachment.garmentCanon).toBe('96-dice'); // law §6.2
  });

  it('assigns a join style to every shape family (law §3.3) — polygons miter, curves round', () => {
    const families: (keyof EngineConfig['joins'])[] = [
      'square', 'rectangle', 'triangle', 'diamond', 'ngon', 'circle', 'pill', 'freeform',
    ];
    for (const f of families) expect(defaultConfig.joins[f]).toBeDefined();
    expect(defaultConfig.joins.triangle).toBe('miter');
    expect(defaultConfig.joins.circle).toBe('round');
    expect(defaultConfig.joins.pill).toBe('round');
    expect(defaultConfig.joins.freeform).toBe('round');
  });

  it('is structured-clone safe (plain JSON, no functions/Maps/Sets)', () => {
    const clone = structuredClone(defaultConfig);
    expect(clone).toEqual(defaultConfig);
    expect(JSON.parse(JSON.stringify(defaultConfig))).toEqual(defaultConfig);
  });

  it('re-derives from any mutated field with zero code edits, without mutating the base', () => {
    // Mutate padding — a downstream size change is driven entirely by config.
    const tighter = resolveConfig({ padding: { radiusMM: 5 } });
    expect(tighter.padding.radiusMM).toBe(5);
    // Everything else is carried through untouched.
    expect(tighter.lattice.basePitchMM).toBe(48);
    expect(tighter.padding.marginAllowanceMM).toBe(12);
    // The frozen default is never mutated by an override.
    expect(defaultConfig.padding.radiusMM).toBe(10);

    // Deep override of a nested law table.
    const noMagneticDice = resolveConfig({
      attachment: { compatibility: { magnetic: ['48-straight'] } },
    });
    expect(noMagneticDice.attachment.compatibility.magnetic).toEqual(['48-straight']);
    expect(defaultConfig.attachment.compatibility.magnetic).toEqual(['48-straight', '96-dice']);
  });

  it('resolveConfig() hands out a fresh object, never the frozen default reference', () => {
    const a = resolveConfig();
    expect(a).toEqual(defaultConfig);
    expect(a).not.toBe(defaultConfig);
  });

  it('configHash is stable, order-independent, and sensitive to any value change', () => {
    const h1 = configHash(defaultConfig);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
    // Same content → same hash (a fresh clone hashes identically).
    expect(configHash(resolveConfig())).toBe(h1);
    // Any change → a different hash (binds catalogues to their exact config, law §8.3).
    expect(configHash(resolveConfig({ padding: { radiusMM: 11 } }))).not.toBe(h1);
  });

  it('resolves fast enough to be a per-call operation (<1ms amortised)', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) configHash(resolveConfig({ frame: { defaultMM: i } }));
    const perCallMs = (performance.now() - start) / 1000;
    expect(perCallMs).toBeLessThan(1);
  });
});
