/**
 * compiler-v2 · typed token codecs (C11 v3 §6.2, §6.3). New layer — does NOT modify the
 * under-review foundation files. Turns a bound value + destination domain into a typed
 * TokenExpr whose `token` leaf is NEVER replaced by the resolved literal (V6). A codec
 * validates the property domain; an illegal value returns { unsupported } instead of emitting
 * syntactically-valid-but-wrong CSS (the failure class §6.2 names).
 *
 * TokenExpr AST (§6.2) — the leaf carries the channel identity so emission conservation (G2)
 * can trace it. Serialization to CSS/React strings is a SEPARATE step (emitter, later).
 */
import { DOMAINS } from './schema.mjs';

/** typed leaf: a live token reference. `channelId` is the resolved registry channel. */
export const tokenLeaf = ({ variableKey, channelId, target, figmaType, destinationDomain }) =>
  ({ kind: 'token', variableKey, channelId, target, figmaType, destinationDomain });

const num = (value, unit) => ({ kind: 'number', value, ...(unit ? { unit } : {}) });
const calc = (op, ...args) => ({ kind: 'calc', op, args });
const unsupported = (reason) => ({ unsupported: reason });
const CSS_DOMAINS = new Set(['color', 'length-px', 'number', 'opacity-normalized', 'string-typography']);

/** allowlisted web font weight/style words → CSS (string-typography domain). */
const WEIGHT_WORDS = {
  thin: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400, book: 400,
  medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800, ultrabold: 800, black: 900, heavy: 900,
};

/**
 * @param domain      one of schema.DOMAINS
 * @param leaf        tokenLeaf(...) for the bound variable
 * @param resolved    { value, figmaType } from the variable graph (for domain validation only —
 *                    the emitted expression keeps the token leaf, never this literal)
 * @returns TokenExpr (with a `token` leaf inside) or { unsupported: reason }
 */
export function codec(domain, leaf, resolved, options = {}) {
  if (!DOMAINS.includes(domain)) return unsupported(`unknown destination domain ${domain}`);
  const t = resolved?.figmaType;
  if (!leaf || leaf.kind !== 'token' || !leaf.variableKey || !leaf.channelId || !['css', 'react'].includes(leaf.target)) return unsupported('codec requires a complete token leaf');
  if (!resolved || !['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(t)) return unsupported('codec requires a resolved typed variable value');
  if (leaf.figmaType !== t) return unsupported(`token leaf type ${leaf.figmaType} differs from resolved type ${t}`);
  if (leaf.destinationDomain !== domain) return unsupported(`token leaf domain ${leaf.destinationDomain} differs from codec domain ${domain}`);
  if (CSS_DOMAINS.has(domain) && leaf.target !== 'css') return unsupported(`${domain} must emit on the css target, not react`);
  switch (domain) {
    case 'color':
      if (t !== 'COLOR' || !validColor(resolved.value)) return unsupported(`color domain needs a legal COLOR value, got ${t}`);
      return leaf; // var(--x) — color values validate as-is
    case 'length-px':
      if (t !== 'FLOAT' || !finite(resolved.value)) return unsupported(`length domain needs a finite FLOAT variable, got ${t}`);
      // a length token must resolve to a legal length; emission wraps the leaf, unit assured by the channel
      return leaf;
    case 'number':
      if (t !== 'FLOAT' || !finite(resolved.value)) return unsupported(`number domain needs a finite FLOAT variable, got ${t}`);
      return leaf;
    case 'opacity-normalized': {
      if (t !== 'FLOAT' || !finite(resolved.value)) return unsupported(`opacity domain needs a finite FLOAT variable, got ${t}`);
      const v = resolved?.value;
      if (options.opacityScale === 'normalized' && v >= 0 && v <= 1) return leaf;
      if (options.opacityScale === 'percent' && v >= 0 && v <= 100) return calc('div', leaf, num(100));
      return unsupported(`opacity requires an explicit normalized|percent scale and an in-range value (got ${v})`);
    }
    case 'string-typography': {
      if (t !== 'STRING') return unsupported(`typography domain needs a STRING variable, got ${t}`);
      if (!['font-weight', 'font-style'].includes(options.typographySlot)) return unsupported('typography codec requires an explicit font-weight|font-style slot');
      const v = String(resolved?.value ?? '').toLowerCase().replace(/\s+/g, '');
      const italic = v.endsWith('italic');
      const base = italic ? v.slice(0, -6) || 'regular' : v;
      if (!v || WEIGHT_WORDS[base] === undefined) {
        return unsupported(`unmapped font style "${resolved.value}" — not a valid web weight/style`);
      }
      return leaf; // the STRING token drives the value; validity checked above
    }
    case 'react-content':
      if (t !== 'STRING') return unsupported(`react-content needs STRING, got ${t}`);
      if (leaf.target !== 'react') return unsupported(`${domain} must emit on the react target, not css`);
      return leaf;
    case 'react-visibility':
      if (t !== 'BOOLEAN') return unsupported(`react-visibility needs BOOLEAN, got ${t}`);
      if (leaf.target !== 'react') return unsupported(`${domain} must emit on the react target, not css`);
      return leaf;
    case 'react-component-prop':
      // React-plane bindings are NOT CSS text — they emit as typed React data (token leaf, react target).
      if (leaf.target !== 'react') return unsupported(`${domain} must emit on the react target, not css`);
      return leaf;
    default:
      return unsupported(`no codec for domain ${domain}`);
  }
}

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validColor = (value) => value && typeof value === 'object' && ['r', 'g', 'b'].every((k) => finite(value[k]) && value[k] >= 0 && value[k] <= 1) &&
  (value.a === undefined || finite(value.a) && value.a >= 0 && value.a <= 1);

/** true when a codec result is a real emission (has a token leaf somewhere), false if unsupported. */
export const isSupported = (expr) => !!expr && !expr.unsupported;

/** walk a TokenExpr collecting its token leaves (emission conservation — every bound leaf survives). */
export function tokenLeaves(expr, out = []) {
  if (!expr || expr.unsupported) return out;
  if (expr.kind === 'token') out.push(expr);
  else if (expr.args) expr.args.forEach((a) => tokenLeaves(a, out));
  else if (expr.items) expr.items.forEach((a) => tokenLeaves(a, out));
  return out;
}
