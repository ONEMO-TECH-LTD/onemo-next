/**
 * Documentation data layer — reads the generated Figma pull (ds-tokens.generated.json)
 * and exposes typed views over it. Every value the documentation renders comes from
 * here at render time; nothing numeric is hand-typed in page bodies (prose law).
 *
 * Works with Figma or without: the JSON is a committed snapshot; refreshing it is the
 * pull pipeline's job (storybook/design-system/tokens/pull-ds-tokens.mjs), not the docs'.
 */

// Webpack imports JSON natively; the typed surface below narrows what pages can touch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import generated from '../design-system/tokens/ds-tokens.generated.json';

type Leaf = {
  $type: string;
  $value: string | number | boolean;
  $scopes?: string[];
  $description?: string;
  $collectionName?: string;
  $hiddenFromPublishing?: boolean;
};
type Tree = { [key: string]: Tree | Leaf };
type ModeMap = Record<string, Tree>;

const EXPORT = (generated as { export: Array<Record<string, { modes: ModeMap }>> }).export;

const COLLECTIONS = new Map<string, ModeMap>(
  EXPORT.map((c) => {
    const name = Object.keys(c)[0];
    return [name, c[name].modes];
  }),
);

export const PRIM_COL = '.1.0-Prim-Col';
export const AL_COL = '.2.0-Al-Col';

function isLeaf(node: Tree | Leaf): node is Leaf {
  return typeof node === 'object' && node !== null && '$type' in node;
}

function leafAt(tree: Tree, dotPath: string): Leaf | null {
  // A node can be BOTH a token and a group (e.g. a pair tone that also carries
  // behavior children), so the walk indexes through any object and only checks
  // leaf-ness at the destination.
  let node: Tree | Leaf | undefined = tree;
  for (const key of dotPath.split('.')) {
    if (!node || typeof node !== 'object') return null;
    node = (node as Tree)[key];
  }
  return node && isLeaf(node) ? node : null;
}

/** Resolve a leaf to its raw value for a theme face, following alias chains. */
export type Face = 'L' | 'D';
function resolveLeaf(leaf: Leaf | null, face: Face, depth = 0): string | null {
  if (!leaf || depth > 8) return null;
  const v = leaf.$value;
  if (typeof v === 'string' && v.startsWith('{') && leaf.$collectionName) {
    const modes = COLLECTIONS.get(leaf.$collectionName);
    if (!modes) return null;
    const names = Object.keys(modes);
    const tree = modes[names.length > 1 ? names[face === 'L' ? 0 : 1] : names[0]];
    return resolveLeaf(leafAt(tree, v.slice(1, -1)), face, depth + 1);
  }
  return typeof v === 'string' ? v : null;
}

/** Resolve any token path in any collection to both theme faces. */
export function resolve(collection: string, slashPath: string): { L: string; D: string } | null {
  const modes = COLLECTIONS.get(collection);
  if (!modes) return null;
  const names = Object.keys(modes);
  const dot = slashPath.split('/').join('.');
  const read = (face: Face) => {
    const tree = modes[names.length > 1 ? names[face === 'L' ? 0 : 1] : names[0]];
    return resolveLeaf(leafAt(tree, dot), face);
  };
  const L = read('L');
  const D = read('D');
  return L && D ? { L, D } : null;
}

/** Split an 8-digit hex into 6-digit + alpha fraction. */
export function splitAlpha(hex: string): { hex: string; alpha: number | null } {
  if (hex.length === 9) return { hex: hex.slice(0, 7), alpha: parseInt(hex.slice(7), 16) / 255 };
  return { hex, alpha: null };
}

export function cssColor(raw: string): string {
  const { hex, alpha } = splitAlpha(raw);
  if (alpha === null) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.round(alpha * 1000) / 1000})`;
}

/** List direct child names of a group within a collection (first mode). */
export function childrenOf(collection: string, slashPath = ''): string[] {
  const modes = COLLECTIONS.get(collection);
  if (!modes) return [];
  const tree = modes[Object.keys(modes)[0]];
  let node: Tree | Leaf | undefined = tree;
  if (slashPath) {
    for (const key of slashPath.split('/')) {
      if (!node || typeof node !== 'object') return [];
      node = (node as Tree)[key];
    }
  }
  if (!node || typeof node !== 'object') return [];
  return Object.keys(node).filter((k) => !k.startsWith('$'));
}

/** A 12-step ramp with both faces, or null if the family isn't ramp-shaped. */
export function ramp(collection: string, family: string): Array<{ step: number; L: string; D: string }> {
  const steps: Array<{ step: number; L: string; D: string }> = [];
  for (let s = 1; s <= 12; s++) {
    const r = resolve(collection, `${family}/${s}`);
    if (!r) return steps;
    steps.push({ step: s, ...r });
  }
  return steps;
}

/** The adaptive primitive colour families (ramp-shaped, non-behavior groups). */
export function primitiveFamilies(): string[] {
  const BEHAVIORS = new Set(['alpha', 'l-constant', 'd-constant', 'l-alpha', 'd-alpha', 'inverse', 'base']);
  return childrenOf(PRIM_COL).filter((k) => !BEHAVIORS.has(k) && ramp(PRIM_COL, k).length === 12);
}

// ── semantic (resolved) ──────────────────────────────────────────────────────
import { RESOLVED } from '../design-system/tokens/sem-col.resolved';

export interface SemToken {
  name: string;
  binding: string;
  description: string;
  L: string;
  D: string;
}

/** Semantic colour tokens with process/migration metadata stripped from descriptions. */
export function semanticFamily(prefix: string): SemToken[] {
  return RESOLVED.tokens
    .filter((t) => t.name.startsWith(prefix))
    .map((t) => ({
      name: t.name,
      binding: t.binding,
      description: (t.description ?? '')
        .replace(/^🔒[^—]*— /, '')
        .replace(/ ?NOTE: name reused[^]*$/, ''),
      L: t.L,
      D: t.D,
    }));
}
