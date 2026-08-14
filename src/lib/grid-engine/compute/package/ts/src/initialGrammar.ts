import type {
  ArrangementClass,
  ArrangementPatternSpec,
  IntPair,
  PatternEdgeSpec,
} from "./contracts.js";

type MutablePoint = [number, number];

type CoordinateEdge = readonly [IntPair, IntPair];

function pointKey(point: IntPair): string {
  return `${point[0]},${point[1]}`;
}

function deterministicStringCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedSites(points: readonly IntPair[]): readonly IntPair[] {
  const copy = points.map(([x, y]) => [x, y] as MutablePoint);
  copy.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (let index = 1; index < copy.length; index += 1) {
    const previous = copy[index - 1]!;
    const current = copy[index]!;
    if (previous[0] === current[0] && previous[1] === current[1]) {
      throw new Error(`duplicate grammar site ${pointKey(current)}`);
    }
  }
  return Object.freeze(copy.map((point) => Object.freeze(point) as IntPair));
}

function buildEdges(sites: readonly IntPair[], coordinateEdges: readonly CoordinateEdge[]): readonly PatternEdgeSpec[] {
  const byCoordinate = new Map<string, number>();
  sites.forEach((site, index) => byCoordinate.set(pointKey(site), index));
  const edges: PatternEdgeSpec[] = coordinateEdges.map(([fromPoint, toPoint]) => {
    const from = byCoordinate.get(pointKey(fromPoint));
    const to = byCoordinate.get(pointKey(toPoint));
    if (from === undefined || to === undefined || from === to) {
      throw new Error("grammar edge references a missing or identical site");
    }
    return { from: Math.min(from, to), to: Math.max(from, to), corridor: "report" };
  });
  edges.sort((a, b) => a.from - b.from || a.to - b.to);
  for (let index = 1; index < edges.length; index += 1) {
    const previous = edges[index - 1]!;
    const current = edges[index]!;
    if (previous.from === current.from && previous.to === current.to) {
      throw new Error("duplicate grammar edge");
    }
  }
  return Object.freeze(edges.map((edge) => Object.freeze(edge)));
}

function makePattern(
  id: string,
  arrangementClass: ArrangementClass,
  points: readonly IntPair[],
  coordinateEdges: readonly CoordinateEdge[] = [],
): ArrangementPatternSpec {
  const sites = sortedSites(points);
  return Object.freeze({
    id,
    class: arrangementClass,
    sites,
    edges: buildEdges(sites, coordinateEdges),
  });
}

function allPairs(points: readonly IntPair[]): CoordinateEdge[] {
  const result: CoordinateEdge[] = [];
  for (let left = 0; left < points.length; left += 1) {
    for (let right = left + 1; right < points.length; right += 1) {
      result.push([points[left]!, points[right]!]);
    }
  }
  return result;
}

/*
 * Initial grammar profile v1 — explicit modelling definitions:
 *
 * - pair means adjacent population sites; both diagonal slopes are present;
 * - complete window means every site in a contiguous w x h population window;
 * - row/column skipping means strict alternating rows/columns, with both outer
 *   rows/columns present (therefore an odd span of 3, 5, 7, or 9);
 * - corner triangle means exactly three corners of any w x h window;
 * - corner rectangle means exactly four corners of any w x h window;
 * - all profile edges are evidence-only corridors. A required corridor must be
 *   written explicitly by changing that edge's mode to "require".
 *
 * These definitions are visible modelling assumptions because the brief names
 * the classes but does not uniquely define their dimensions or skip masks.
 */
export function buildInitialGrammarV1(): readonly ArrangementPatternSpec[] {
  const patterns: ArrangementPatternSpec[] = [];

  patterns.push(makePattern("single.1", "single_site", [[0, 0]]));
  patterns.push(makePattern("pair.h.adjacent", "horizontal_pair", [[0, 0], [1, 0]], [[[0, 0], [1, 0]]]));
  patterns.push(makePattern("pair.v.adjacent", "vertical_pair", [[0, 0], [0, 1]], [[[0, 0], [0, 1]]]));
  patterns.push(makePattern("pair.d.rising", "diagonal_pair", [[0, 0], [1, 1]], [[[0, 0], [1, 1]]]));
  patterns.push(makePattern("pair.d.falling", "diagonal_pair", [[0, 1], [1, 0]], [[[0, 1], [1, 0]]]));

  for (let width = 2; width <= 9; width += 1) {
    for (let height = 2; height <= 9; height += 1) {
      const sites: MutablePoint[] = [];
      const edges: CoordinateEdge[] = [];
      for (let x = 0; x < width; x += 1) {
        for (let y = 0; y < height; y += 1) {
          sites.push([x, y]);
          if (x + 1 < width) edges.push([[x, y], [x + 1, y]]);
          if (y + 1 < height) edges.push([[x, y], [x, y + 1]]);
        }
      }
      patterns.push(makePattern(
        `rect.full.w${width}.h${height}`,
        "complete_rectangular_window",
        sites,
        edges,
      ));
    }
  }

  for (let width = 1; width <= 9; width += 1) {
    for (const height of [3, 5, 7, 9]) {
      const rows = Array.from({ length: (height + 1) / 2 }, (_, index) => index * 2);
      const sites: MutablePoint[] = [];
      const edges: CoordinateEdge[] = [];
      for (let x = 0; x < width; x += 1) {
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          const y = rows[rowIndex]!;
          sites.push([x, y]);
          if (x + 1 < width) edges.push([[x, y], [x + 1, y]]);
          if (rowIndex + 1 < rows.length) edges.push([[x, y], [x, rows[rowIndex + 1]!]]);
        }
      }
      patterns.push(makePattern(
        `skip.rows.alternate.w${width}.h${height}`,
        "row_skipping",
        sites,
        edges,
      ));
    }
  }

  for (const width of [3, 5, 7, 9]) {
    for (let height = 1; height <= 9; height += 1) {
      const columns = Array.from({ length: (width + 1) / 2 }, (_, index) => index * 2);
      const sites: MutablePoint[] = [];
      const edges: CoordinateEdge[] = [];
      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const x = columns[columnIndex]!;
        for (let y = 0; y < height; y += 1) {
          sites.push([x, y]);
          if (columnIndex + 1 < columns.length) edges.push([[x, y], [columns[columnIndex + 1]!, y]]);
          if (y + 1 < height) edges.push([[x, y], [x, y + 1]]);
        }
      }
      patterns.push(makePattern(
        `skip.cols.alternate.w${width}.h${height}`,
        "column_skipping",
        sites,
        edges,
      ));
    }
  }

  const cornerNames = ["bottom-left", "top-left", "bottom-right", "top-right"] as const;
  for (let width = 2; width <= 9; width += 1) {
    for (let height = 2; height <= 9; height += 1) {
      const corners = [
        [0, 0],
        [0, height - 1],
        [width - 1, 0],
        [width - 1, height - 1],
      ] as const satisfies readonly IntPair[];
      for (let missing = 0; missing < corners.length; missing += 1) {
        const triangle = corners.filter((_, index) => index !== missing);
        patterns.push(makePattern(
          `corner.triangle.w${width}.h${height}.missing-${cornerNames[missing]!}`,
          "corner_triangle",
          triangle,
          allPairs(triangle),
        ));
      }
      patterns.push(makePattern(
        `corner.rectangle.w${width}.h${height}`,
        "corner_rectangle",
        corners,
        [
          [corners[0]!, corners[1]!],
          [corners[0]!, corners[2]!],
          [corners[1]!, corners[3]!],
          [corners[2]!, corners[3]!],
        ],
      ));
    }
  }

  patterns.sort((left, right) =>
    deterministicStringCompare(left.class, right.class) || deterministicStringCompare(left.id, right.id),
  );
  return Object.freeze(patterns);
}

export const INITIAL_GRAMMAR_V1 = buildInitialGrammarV1();
