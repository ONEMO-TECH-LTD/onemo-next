/**
 * compiler-v2 · raw alias inventory + classifier (C11 v3 §5.3, V2; G1).
 *
 * Discovery is RECURSIVE and NAME-AGNOSTIC: every VARIABLE_ALIAS occurrence in the raw REST
 * document is recorded with its JSON pointer, then classified by carrier shape:
 *   canonical            — owns a render/behavior slot (carrier-local, node scalar, keyed object)
 *   mirror-of:<id>       — compacted node metadata (boundVariables.fills/strokes/effects lists);
 *                          NEVER positional truth; must link to a same-node canonical record
 *   nonvisual-metadata   — finite reviewed list only (schema.NONVISUAL_METADATA_PATHS)
 *   unknown-carrier      — FATAL (G1): a new Figma location fails loudly, never bakes
 *
 * No wildcards. An unmatched mirror is unknown-carrier (it would mean REST metadata references
 * a binding the carrier walk didn't find — silence is forbidden).
 */
import { NONVISUAL_METADATA_PATHS } from './schema.mjs';
import { canonicalJson } from './evidence.mjs';

/** RFC 6901 token escaping — component-property keys may contain '/' or '~' and must stay
 *  unambiguous source identity (Meta probe finding 5b). */
export const escapePointerToken = (k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1');
export const unescapePointerToken = (t) => String(t).replace(/~1/g, '/').replace(/~0/g, '~');

/** Every alias occurrence in document order (pointers RFC6901-escaped). */
export function collectOccurrences(document) {
  const out = [];
  (function walkNode(n) {
    if (!n) return;
    (function scan(x, pointer) {
      if (Array.isArray(x)) { x.forEach((v, i) => scan(v, `${pointer}/${i}`)); return; }
      if (x !== null && typeof x === 'object') {
        if (x.type === 'VARIABLE_ALIAS' && typeof x.id === 'string') {
          out.push({ nodeId: n.id, jsonPointer: pointer, variableId: x.id });
          return;
        }
        for (const [k, v] of Object.entries(x)) {
          if (k === 'children') continue; // children are walked as their own nodes
          scan(v, `${pointer}/${escapePointerToken(k)}`);
        }
      }
    })(n, '');
    (n.children ?? []).forEach(walkNode);
  })(document);
  return out;
}

// ── pointer grammars → canonical slot + destination domain ─────────────────────────────────
const RULES = [
  // carrier-local paints & stops (the E1/E2 law)
  { re: /^\/fills\/(\d+)\/boundVariables\/color$/, slot: (m) => ({ kind: 'paint', index: +m[1] }), path: (m) => `/fills/${m[1]}/color`, domain: 'color' },
  { re: /^\/fills\/(\d+)\/gradientStops\/(\d+)\/boundVariables\/color$/, slot: (m) => ({ kind: 'stop', index: +m[2], paint: +m[1] }), path: (m) => `/fills/${m[1]}/stops/${m[2]}/color`, domain: 'color' },
  // Figma's DEPRECATED `background` FRAME property is the predecessor to `fills`; REST emits it
  // as a duplicate of the fills paints. Its bindings are a STRICT MIRROR of fills — accepted ONLY
  // when the containing paint (or gradient stop) structurally EQUALS the same-index fills paint
  // (proving exact duplication incl. alias). Any divergence → UNKNOWN/fail-loud (Meta strict law).
  // `backgroundColor` (deprecated derived scalar) has no live-evidenced binding shape → stays
  // UNKNOWN until a plugin-backed fixture proves it (no generic acceptance).
  { re: /^\/background\/(\d+)\/boundVariables\/color$/, backgroundMirror: (m) => ({ paint: +m[1] }) },
  { re: /^\/background\/(\d+)\/gradientStops\/(\d+)\/boundVariables\/color$/, backgroundMirror: (m) => ({ paint: +m[1], stop: +m[2] }) },
  { re: /^\/strokes\/(\d+)\/boundVariables\/color$/, slot: (m) => ({ kind: 'stroke', index: +m[1] }), path: (m) => `/strokes/${m[1]}/color`, domain: 'color' },
  { re: /^\/strokes\/(\d+)\/gradientStops\/(\d+)\/boundVariables\/color$/, slot: (m) => ({ kind: 'stop', index: +m[2], paint: +m[1], of: 'stroke' }), path: (m) => `/strokes/${m[1]}/stops/${m[2]}/color`, domain: 'color' },
  // carrier-local effects (E3)
  { re: /^\/effects\/(\d+)\/boundVariables\/(radius|spread|offsetX|offsetY)$/, slot: (m) => ({ kind: 'effect', index: +m[1], field: m[2] }), path: (m) => `/effects/${m[1]}/${m[2]}`, domain: 'length-px' },
  { re: /^\/effects\/(\d+)\/boundVariables\/color$/, slot: (m) => ({ kind: 'effect', index: +m[1], field: 'color' }), path: (m) => `/effects/${m[1]}/color`, domain: 'color' },
  // node scalars
  { re: /^\/boundVariables\/(itemSpacing|paddingTop|paddingRight|paddingBottom|paddingLeft|strokeWeight|cornerRadius|maxWidth|minWidth|maxHeight|minHeight|counterAxisSpacing)$/, path: (m) => `/${m[1]}`, domain: 'length-px' },
  { re: /^\/boundVariables\/opacity$/, path: () => '/opacity', domain: 'opacity-normalized' },
  { re: /^\/boundVariables\/visible$/, path: () => '/visible', domain: 'react-visibility' },
  { re: /^\/boundVariables\/characters$/, path: () => '/characters', domain: 'react-content' },
  // keyed objects (E5, radii, size)
  { re: /^\/boundVariables\/individualStrokeWeights\/(BORDER_(?:TOP|RIGHT|BOTTOM|LEFT)_WEIGHT)$/, path: (m) => `/individualStrokeWeights/${m[1]}`, domain: 'length-px' },
  { re: /^\/boundVariables\/rectangleCornerRadii\/(RECTANGLE_(?:TOP|BOTTOM)_(?:LEFT|RIGHT)_CORNER_RADIUS)$/, path: (m) => `/rectangleCornerRadii/${m[1]}`, domain: 'length-px' },
  { re: /^\/boundVariables\/rectangleCornerRadii\/(\d+)$/, path: (m) => `/rectangleCornerRadii/${m[1]}`, domain: 'length-px' },
  { re: /^\/boundVariables\/size\/(x|y)$/, path: (m) => `/size/${m[1]}`, domain: 'length-px' },
  // text properties — arrays per style range (uniform text = [0])
  { re: /^\/boundVariables\/(fontSize|lineHeight|letterSpacing|paragraphIndent)\/(\d+)$/, slot: (m) => ({ kind: 'text-range', index: +m[2] }), path: (m) => `/${m[1]}/${m[2]}`, domain: 'length-px' },
  { re: /^\/boundVariables\/(fontFamily|fontStyle|fontWeight)\/(\d+)$/, slot: (m) => ({ kind: 'text-range', index: +m[2] }), path: (m) => `/${m[1]}/${m[2]}`, domain: 'string-typography' },
  { re: /^\/boundVariables\/fills\/(\d+)$/, mirror: 'fills' },
  { re: /^\/boundVariables\/strokes\/(\d+)$/, mirror: 'strokes' },
  { re: /^\/boundVariables\/effects\/(\d+)$/, mirror: 'effects' },
  // component properties (react domain)
  { re: /^\/boundVariables\/componentProperties\/(.+)$/, path: (m) => `/componentProperties/${m[1]}`, domain: 'react-component-prop' },
  { re: /^\/componentProperties\/([^/]+)\/boundVariables\/value$/, path: (m) => `/componentProperties/${m[1]}`, domain: 'react-component-prop' },
];

const NONVISUAL_RE = new RegExp(`^\\/boundVariables\\/(${NONVISUAL_METADATA_PATHS.join('|')})(\\/\\d+)?$`);

/** structural deep-equality via canonical JSON — proves exact paint/stop duplication. */
const deepEqual = (a, b) => canonicalJson(a) === canonicalJson(b);

/**
 * Classify every occurrence. Returns { canonical, mirrors, nonvisual, unknown }.
 * `unknown.length > 0` is a G1 hard failure — the caller must not proceed to lowering.
 * @param document  required to validate the STRICT background-mirror law (structural equality
 *                  to the same-index fills paint/stop). Without it, background occurrences are
 *                  fail-loud UNKNOWN (a mirror cannot be proven without carrier context).
 */
export function classifyOccurrences(occurrences, document = null) {
  const byId = new Map();
  if (document) (function idx(n) { if (!n) return; byId.set(n.id, n); (n.children ?? []).forEach(idx); })(document);
  const canonical = [], mirrors = [], nonvisual = [], unknown = [];
  for (const occ of occurrences) {
    if (NONVISUAL_RE.test(occ.jsonPointer)) { nonvisual.push(occ); continue; }
    let matched = false;
    for (const rule of RULES) {
      const m = occ.jsonPointer.match(rule.re);
      if (!m) continue;
      matched = true;
      if (rule.backgroundMirror) {
        // STRICT: prove the deprecated background paint/stop EXACTLY equals the same-index fills
        // paint/stop (same alias + same containing structure). Any divergence → UNKNOWN.
        const { paint, stop } = rule.backgroundMirror(m);
        const node = byId.get(occ.nodeId);
        const bg = node?.background?.[paint], fl = node?.fills?.[paint];
        const bgUnit = stop === undefined ? bg : bg?.gradientStops?.[stop];
        const flUnit = stop === undefined ? fl : fl?.gradientStops?.[stop];
        if (!node) unknown.push({ ...occ, reason: 'background mirror needs document context (none provided)' });
        else if (!fl) unknown.push({ ...occ, reason: `background[${paint}] has no matching fills[${paint}] — divergent deprecated payload` });
        else if (!deepEqual(bg, fl)) unknown.push({ ...occ, reason: `background[${paint}] not structurally equal to fills[${paint}] (alias/stop/paint divergence)` });
        else if (!bgUnit || !deepEqual(bgUnit, flUnit)) unknown.push({ ...occ, reason: `background[${paint}] stop/paint unit mismatch vs fills` });
        else mirrors.push({ ...occ, mirrorOf: 'fills', proven: 'background-structural' });
      } else if (rule.mirror) mirrors.push({ ...occ, mirrorOf: rule.mirror });
      else canonical.push({ ...occ, propertyPath: rule.path(m), slot: rule.slot?.(m), destinationDomain: rule.domain });
      break;
    }
    if (!matched) unknown.push(occ);
  }
  // mirror linkage: a mirror must reference a variableId owning a same-node canonical IN THE
  // SAME CARRIER FAMILY (fills/strokes/effects) — same-node+same-variable across families is
  // NOT linkage (Meta probe finding 5a: an effects mirror must not pass on a fill canonical).
  const familyOf = (c) => {
    const head = c.propertyPath.split('/')[1]; // RFC6901 pointer: leading '/', family at [1]
    return head === 'fills' || head === 'strokes' || head === 'effects' ? head : null;
  };
  const byNodeFamily = new Map();
  for (const c of canonical) {
    const fam = familyOf(c);
    if (!fam) continue;
    const key = `${c.nodeId}␟${fam}`;
    if (!byNodeFamily.has(key)) byNodeFamily.set(key, new Set());
    byNodeFamily.get(key).add(c.variableId);
  }
  for (const m of mirrors) {
    if (!byNodeFamily.get(`${m.nodeId}␟${m.mirrorOf}`)?.has(m.variableId)) {
      unknown.push({ ...m, reason: `mirror ${m.mirrorOf} references variable with no same-node canonical carrier in the ${m.mirrorOf} family` });
    }
  }
  return { canonical, mirrors, nonvisual, unknown };
}
