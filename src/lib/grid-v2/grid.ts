/**
 * Grid Lab v2 — P1 · GridGenerator
 *
 * Construct a magnet population on the lattice (law §3.1), mask it by mode (law §4.1), and name
 * its defining vertices. A pure `fn(request, config)` — no physical size exists here yet; size is
 * a later consequence of the construction (law §3.4), never an input.
 *
 * Patterns (law §4.3a): straight (Cartesian), diamond (checkerboard → 48·√2 diagonal links),
 * dice/quincunx (grid + cell centres, legal ONLY at 96 where the centres land on 48-offsets).
 */
import type { EngineConfig, Pattern } from './config';
import type { GridRequest, GridResult, Pt } from './types';

/** Exact lattice-point key (all pattern coordinates are integer multiples of pitch/2 → exact). */
const key = (p: Pt): string => `${Math.round(p.x * 1000)}:${Math.round(p.y * 1000)}`;

/**
 * Nearest-neighbour offsets for the interior test, per pattern (law §4.3a adjacency).
 * A magnet is interior only when ALL of these positions are occupied.
 */
export function neighbourVectors(pattern: Pattern, pitchMM: number): Pt[] {
  const h = pitchMM / 2;
  switch (pattern) {
    case 'straight':
      return [{ x: pitchMM, y: 0 }, { x: -pitchMM, y: 0 }, { x: 0, y: pitchMM }, { x: 0, y: -pitchMM }];
    case 'diamond':
      return [{ x: pitchMM, y: pitchMM }, { x: pitchMM, y: -pitchMM }, { x: -pitchMM, y: pitchMM }, { x: -pitchMM, y: -pitchMM }];
    case 'dice':
      return [{ x: h, y: h }, { x: h, y: -h }, { x: -h, y: h }, { x: -h, y: -h }];
  }
  throw new Error(`unknown pattern '${pattern}'`);
}

/**
 * The population's boundary ring (law §4.1): every magnet with at least one absent
 * nearest-neighbour. Shape-agnostic — this is the Light mask, reused by P3 for shape populations.
 * Corners are the degenerate small case (a thin/small population is all-perimeter). Interior
 * magnets — those with every nearest-neighbour occupied — drop.
 */
export function boundaryRing(population: Pt[], pattern: Pattern, pitchMM: number): Pt[] {
  const present = new Set(population.map(key));
  const nbrs = neighbourVectors(pattern, pitchMM);
  return population.filter((p) =>
    nbrs.some((v) => !present.has(key({ x: p.x + v.x, y: p.y + v.y }))),
  );
}

/** The extreme-corner magnets of a population — the defining vertices of a rectangular block. */
export function extremeVertices(population: Pt[]): Pt[] {
  if (population.length === 0) return [];
  const xs = population.map((p) => p.x);
  const ys = population.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const corners: Pt[] = [
    { x: minX, y: minY }, { x: maxX, y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY },
  ];
  const d2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const picked = corners.map((c) =>
    population.reduce((best, p) => (d2(p, c) < d2(best, c) ? p : best), population[0]),
  );
  const seen = new Set<string>();
  return picked.filter((p) => {
    const k = key(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** The axis-aligned lattice block for a pattern (law §1, §4.3a). */
function latticeBlock(nx: number, ny: number, pitchMM: number, pattern: Pattern, config: EngineConfig): Pt[] {
  const pts: Pt[] = [];
  switch (pattern) {
    case 'straight':
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push({ x: i * pitchMM, y: j * pitchMM });
      break;
    case 'diamond':
      // Checkerboard subset of the axis lattice — kept nodes' nearest neighbours are diagonal (48·√2).
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if ((i + j) % 2 === 0) pts.push({ x: i * pitchMM, y: j * pitchMM });
      break;
    case 'dice': {
      // Dice/quincunx is legal ONLY at the released dice pitch (96) — its centres land on 48-offsets.
      if (pitchMM !== config.patterns.dicePitchMM) {
        throw new Error(
          `dice pattern is legal only at pitch ${config.patterns.dicePitchMM}mm (got ${pitchMM}mm) — its centres must land on valid lattice offsets (law §4.3a)`,
        );
      }
      const h = pitchMM / 2;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push({ x: i * pitchMM, y: j * pitchMM });
      for (let i = 0; i < nx - 1; i++) for (let j = 0; j < ny - 1; j++) pts.push({ x: i * pitchMM + h, y: j * pitchMM + h });
      break;
    }
  }
  return pts;
}

/**
 * P1 · GridGenerator. Pure `fn(request, config)`. Source-blind by construction — there is no
 * source parameter, so an identical request yields an identical population under every caller
 * (law §5.1).
 */
export function generateGrid(request: GridRequest, config: EngineConfig): GridResult {
  const { span, pitchMM, pattern, mode } = request;

  // Illegal combinations fail loudly — no silent fallback (law §9.2).
  if (!config.patterns.available.includes(pattern)) {
    throw new Error(`pattern '${pattern}' is not in the released pattern set (law §4)`);
  }
  if (!config.lattice.pitchSetMM.includes(pitchMM)) {
    throw new Error(`pitch ${pitchMM}mm is not in the released pitch set ${JSON.stringify(config.lattice.pitchSetMM)} (law §1.1)`);
  }
  if (span.nx < 1 || span.ny < 1) {
    throw new Error(`span must be at least 1×1 (got ${span.nx}×${span.ny})`);
  }

  const full = latticeBlock(span.nx, span.ny, pitchMM, pattern, config);
  const population = mode === 'light' ? boundaryRing(full, pattern, pitchMM) : full;
  const vertices = extremeVertices(full); // the shape-defining corners; identical in either mode
  return { population, vertices };
}
