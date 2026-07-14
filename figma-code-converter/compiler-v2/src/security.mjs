/** P5 source-string boundaries. Compiler dependency only; generated packages have no runtime dependency. */
import { parseDocument } from 'htmlparser2';
import serializer from 'dom-serializer';
import postcss from 'postcss';
import path from 'node:path';

const SVG_ELEMENTS = new Set(['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'filter', 'feGaussianBlur', 'feOffset', 'feColorMatrix', 'feBlend', 'use', 'title', 'desc']);
const SVG_ATTRIBUTES = new Set(['id', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'transform', 'gradientUnits', 'gradientTransform', 'offset', 'stop-color', 'stop-opacity', 'clip-path', 'mask', 'filter', 'href', 'xlink:href', 'xmlns', 'preserveAspectRatio', 'result', 'in', 'in2', 'stdDeviation', 'dx', 'dy', 'values', 'type', 'operator', 'mode']);
const CSS_PROPERTY = /^(?:--[A-Za-z_][A-Za-z0-9_-]*|[a-z][a-z0-9-]*)$/;
const NAMESPACE = /^[A-Za-z0-9_-]+$/;
const serialize = serializer.default ?? serializer;

export class SecurityError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_STATIC'; }
}

export function sanitizeSvg(input, { namespace, maxBytes = 100_000, maxNodes = 5_000, maxPathData = 100_000, maxFilterDepth = 8 } = {}) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > maxBytes) throw new SecurityError('SVG missing or exceeds byte limit');
  if (!NAMESPACE.test(namespace ?? '')) throw new SecurityError('SVG namespace invalid');
  const document = parseDocument(input, { xmlMode: true, lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true });
  const roots = document.children.filter((node) => node.type === 'tag');
  if (roots.length !== 1 || roots[0].name !== 'svg') throw new SecurityError('SVG must have exactly one svg root');
  if (document.children.some((node) => node.type === 'text' && node.data.trim())) throw new SecurityError('SVG has text outside root');
  const ids = new Map();
  const rewrittenIds = new Set();
  let nodeCount = 0;
  const visit = (node, filterDepth = 0) => {
    if (node.type === 'text') return;
    if (node.type === 'comment' || node.type === 'directive' || node.type === 'cdata') throw new SecurityError(`SVG node type ${node.type} forbidden`);
    if (node.type !== 'tag' || !SVG_ELEMENTS.has(node.name)) throw new SecurityError(`SVG element ${node.name ?? node.type} forbidden`);
    nodeCount += 1;
    if (nodeCount > maxNodes) throw new SecurityError('SVG node limit exceeded');
    const nextFilterDepth = node.name === 'filter' || node.name.startsWith('fe') ? filterDepth + 1 : filterDepth;
    if (nextFilterDepth > maxFilterDepth) throw new SecurityError('SVG filter depth exceeded');
    for (const [name, value] of Object.entries(node.attribs ?? {})) {
      if (/^on/i.test(name) || name === 'style' || !SVG_ATTRIBUTES.has(name)) throw new SecurityError(`SVG attribute ${name} forbidden`);
      if (name === 'd' && value.length > maxPathData) throw new SecurityError('SVG path-data limit exceeded');
      if (name === 'id') {
        if (!value || ids.has(value)) throw new SecurityError(`SVG duplicate/empty id ${value}`);
        const rewritten = `${namespace}__${value.replace(/[^A-Za-z0-9_-]/g, '_')}`;
        if (rewrittenIds.has(rewritten)) throw new SecurityError(`SVG ids collide after namespace rewrite: ${value}`);
        rewrittenIds.add(rewritten);
        ids.set(value, rewritten);
      }
      if ((name === 'href' || name === 'xlink:href') && !String(value).startsWith('#')) throw new SecurityError('SVG href must be local');
      const urls = [...String(value).matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)].map((match) => match[1]);
      if (urls.some((url) => !url.startsWith('#'))) throw new SecurityError('SVG url() must be local');
      if (/\b(?:javascript|data|https?):/i.test(String(value))) throw new SecurityError('SVG remote/executable value forbidden');
    }
    for (const child of node.children ?? []) visit(child, nextFilterDepth);
  };
  visit(roots[0]);
  const localId = (id) => {
    const rewritten = ids.get(id);
    if (!rewritten) throw new SecurityError(`SVG local reference #${id} has no target`);
    return rewritten;
  };
  const rewrite = (node) => {
    if (node.type !== 'tag') return;
    for (const [name, raw] of Object.entries(node.attribs ?? {})) {
      let value = raw;
      if (name === 'id') value = ids.get(raw);
      if ((name === 'href' || name === 'xlink:href') && raw.startsWith('#')) value = `#${localId(raw.slice(1))}`;
      value = value.replace(/url\(\s*["']?#([^"')\s]+)["']?\s*\)/gi, (_, id) => `url(#${localId(id)})`);
      node.attribs[name] = value;
    }
    for (const child of node.children ?? []) rewrite(child);
  };
  rewrite(roots[0]);
  const output = serialize(roots[0], { xmlMode: true, encodeEntities: 'utf8' });
  if (Buffer.byteLength(output) > maxBytes) throw new SecurityError('sanitized SVG exceeds byte limit');
  return output;
}

export function assertSafeCssValue(value, property) {
  if (typeof value !== 'string' || !value || !CSS_PROPERTY.test(property ?? '')) throw new SecurityError('CSS property/value invalid');
  if (/[{}]|\/\*/.test(value) || /expression\s*\(|@import\b/i.test(value) || /url\s*\(\s*["']?(?:https?:|data:|javascript:)/i.test(value)) throw new SecurityError(`unsafe CSS value for ${property}`);
  let root;
  try { root = postcss.parse(`a{${property}:${value}}`); } catch { throw new SecurityError(`CSS value does not parse for ${property}`); }
  const rule = root.nodes[0];
  if (root.nodes.length !== 1 || rule?.type !== 'rule' || rule.nodes.length !== 1 || rule.nodes[0].type !== 'decl' || rule.nodes[0].prop !== property || rule.nodes[0].value !== value) throw new SecurityError(`CSS value escapes its declaration for ${property}`);
  return value;
}

export function safeHref(value) {
  if (typeof value !== 'string' || !value) throw new SecurityError('link href missing');
  if (value.startsWith('//')) throw new SecurityError('protocol-relative link forbidden');
  if (value.startsWith('#') || value.startsWith('/') || value.startsWith('./')) return { href: value, external: false };
  let parsed;
  try { parsed = new URL(value); } catch { throw new SecurityError('link href invalid'); }
  if (!['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new SecurityError(`link protocol ${parsed.protocol} forbidden`);
  return { href: parsed.href, external: ['https:', 'http:'].includes(parsed.protocol) };
}

export function confinedAssetPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || path.posix.isAbsolute(value)) throw new SecurityError('asset path invalid');
  const normalized = path.posix.normalize(value);
  if (normalized === '..' || normalized.startsWith('../') || normalized !== value) throw new SecurityError('asset path escapes package');
  return normalized;
}
