/**
 * compiler-v2 · schemas & truth states (C11 v3 §2, §3 V1/V3, §4.3, §5.3, §9).
 * Every persisted artifact carries schemaVersion; consumers REFUSE unknown versions (§3.6 law
 * from v2.1, carried into v3 manifest rules). Pure data module — no I/O.
 */

export const SCHEMA = Object.freeze({
  manifest: 1,
  supplement: 1,
  bindingRecord: 1,
  capability: 1,
  tokenRegistry: 1,
  sourceMap: 1,
  fidelityBudgets: 1,
  verdict: 1,
});

/** §2 — the only terminal states. No generic PASS/OK exists. */
export const STATES = Object.freeze([
  'PROMOTABLE_VERIFIED',
  'DIAGNOSTIC_ONLY',
  'CANCELLED',
  'FAILED_CAPTURE',
  'FAILED_CAPABILITY',
  'FAILED_BINDING',
  'FAILED_COMPONENT',
  'FAILED_STATIC',
  'FAILED_RUNTIME',
  'FAILED_VISUAL',
  'FAILED_EDITOR',
]);

/** §5.3 / §6.1 destination domains — one Figma variable may need several channels. */
export const DOMAINS = Object.freeze([
  'color',            // paints, stops, effect colors, text fills
  'length-px',        // dims, gaps, paddings, radii, stroke widths, offsets
  'opacity-normalized', // Figma 0–100 or 0–1 → CSS opacity grammar
  'number',           // unitless
  'string-typography',// STRING style values → validated weight/style
  'react-content',    // STRING characters bindings
  'react-visibility', // BOOLEAN visible bindings
  'react-component-prop', // componentProperties bindings
]);

/** §5.3 binding-carrier slots. */
export const SLOT_KINDS = Object.freeze(['paint', 'stop', 'effect', 'stroke', 'text-range']);

/** Alias-occurrence classes (§3.2 of v2.1 inventory law, carried into v3 §5.3). */
export const OCCURRENCE_CLASSES = Object.freeze([
  'canonical', 'mirror', 'nonvisual-metadata', 'unknown-carrier',
]);

/** The finite reviewed nonvisual-metadata property list (Meta ruling: no wildcards). */
export const NONVISUAL_METADATA_PATHS = Object.freeze([
  'paragraphSpacing', // no CSS slot in current flow model; disposition inactive-proven requires single-paragraph proof
]);

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Refuse-on-unknown-schema helper: returns null when acceptable, error string otherwise. */
export function schemaError(kind, artifact) {
  if (!isObj(artifact)) return `${kind}: not an object`;
  const v = artifact.schemaVersion;
  if (v === undefined) return `${kind}: missing schemaVersion`;
  if (v !== SCHEMA[kind]) return `${kind}: schemaVersion ${v} unknown (supported: ${SCHEMA[kind]})`;
  return null;
}

/** The fact families whose source plane MUST be declared (joint route: per-fact provenance). */
export const REQUIRED_SOURCE_PLANES = Object.freeze(['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'references', 'dependencies']);

/** Closed provenance vocabulary (joint route) — a forged/free-text plane value is a refusal.
 *  'fixture' is legal ONLY for §14.1 microfixture snapshots and never clears supplement-
 *  dependent capability (that gating lives with the capability registry, G-5). */
export const SOURCE_PLANE_VALUES = Object.freeze([
  'plugin-primary-complete', 'plugin-primary-partial', 'rest-cross-check', 'rest-only', 'fixture',
]);

/** RFC 6901: '~' is legal ONLY as ~0/~1. A '~2'-class token is an invalid pointer, not identity. */
export const invalidPointer = (p) =>
  typeof p !== 'string' || !p.startsWith('/') || /~(?![01])/.test(p);

/** The contracted evidence file set (§4.3). Mirrored by evidence.REQUIRED_EVIDENCE_FILES. */
const REQUIRED_FILES = Object.freeze([
  'document.rest.json', 'supplement.json', 'variables.json', 'components.json', 'fonts.json',
  'dependencies.json', 'references/manifest.json',
]);

/** Structural validators — fail loud with the exact missing path. An EMPTY files/sourcePlanes/
 *  census map is a refusal, not a pass (Meta probe finding 1). */
export function validateManifest(m) {
  const e = schemaError('manifest', m);
  if (e) return [e];
  const errs = [];
  for (const k of ['fileKey', 'fileVersion', 'rootIds', 'captureId', 'files', 'census', 'sourcePlanes', 'compilerVersion', 'capabilityRegistryVersion']) {
    if (m[k] === undefined) errs.push(`manifest.${k} missing`);
  }
  for (const rel of REQUIRED_FILES) {
    if (!m.files?.[rel]) errs.push(`manifest.files missing contracted evidence: ${rel}`);
  }
  if (m.files && !Object.values(m.files).every((f) => f?.sha256 && Number.isInteger(f?.bytes))) {
    errs.push('manifest.files entries need {sha256, bytes}');
  }
  for (const fam of REQUIRED_SOURCE_PLANES) {
    const v = m.sourcePlanes?.[fam];
    if (!v) errs.push(`manifest.sourcePlanes.${fam} missing (per-fact provenance is mandatory)`);
    else if (!SOURCE_PLANE_VALUES.includes(v)) errs.push(`manifest.sourcePlanes.${fam} value '${v}' outside the closed provenance vocabulary — forged/free-text planes refused`);
  }
  for (const k of ['nodes', 'aliases', 'textRuns', 'variables', 'components', 'supplementNodes']) {
    if (!Number.isInteger(m.census?.[k])) errs.push(`manifest.census.${k} missing`);
  }
  if (!m.fingerprint) errs.push('manifest.fingerprint missing');
  return errs;
}

export function validateBindingRecord(r) {
  const e = schemaError('bindingRecord', r);
  if (e) return [e];
  const errs = [];
  if (!r.bindingId) errs.push('bindingId missing');
  if (!r.source?.fileKey) errs.push('source.fileKey missing — identity facts never coalesce (G2)');
  if (!r.source?.nodeId || !r.source?.propertyPath) errs.push('source.nodeId/propertyPath missing');
  if (r.source?.propertyPath && invalidPointer(r.source.propertyPath)) errs.push('source.propertyPath must be a VALID RFC6901 JSON Pointer (leading /, ~ only as ~0/~1)');
  if (r.source?.slot) {
    const s = r.source.slot;
    if (!SLOT_KINDS.includes(s.kind)) errs.push(`slot.kind ${s.kind} invalid`);
    if (!Number.isInteger(s.index) || s.index < 0) errs.push('slot.index must be a non-negative integer');
    if (s.kind === 'stop' && !Number.isInteger(s.paint)) errs.push('stop slot requires paint linkage (slot.paint)');
  }
  if (r.source?.textRange) {
    const t = r.source.textRange;
    if (!Number.isInteger(t.start) || !Number.isInteger(t.end) || t.start < 0 || t.end <= t.start) {
      errs.push('textRange must satisfy 0 ≤ start < end (integers)');
    }
  }
  if (!r.variable?.key) errs.push('variable.key (stable) missing — hard-fail per §6.1, captureId is not identity');
  if (!r.variable?.collectionKey) errs.push('variable.collectionKey missing — identity facts never coalesce (G2)');
  if (!r.variable?.captureId) errs.push('variable.captureId missing');
  if (!r.variable?.figmaType) errs.push('variable.figmaType missing');
  if (!r.modeContextId) errs.push('modeContextId missing — root-for-descendant substitution is forbidden (V5)');
  if (!r.resolutionTraceId) errs.push('resolutionTraceId missing — untraceable chains cannot promote (§3.5 mode-graph law)');
  if (!DOMAINS.includes(r.destinationDomain)) errs.push(`destinationDomain ${r.destinationDomain} invalid`);
  if (!['css', 'react'].includes(r.emissionTarget)) errs.push('emissionTarget invalid');
  if (!['pending', 'emitted', 'inactive-proven', 'unsupported'].includes(r.disposition)) errs.push('disposition invalid');
  return errs;
}

/**
 * G2 identity (§12 G2, §6.1) — TWO keys, split concerns (Meta rework, pre-commit correction 2):
 *
 * sourceBindingIdentity: REQUIRES the stable variable key (V3 §6.1: missing stable keys
 * hard-fail — captureId is NOT legal promotable identity) and covers
 * file/node/property/slot/range/mode/domain/target.
 *
 * emittedBindingIdentity: source identity PLUS the resolved registry channelId — same
 * domain+target with a swapped channel must change the emitted conservation key.
 *
 * formatBindingForError: diagnostic ONLY — may show a missing key via its captureId, visibly
 * marked; never used as a gate key.
 */
const slotStr = (s) => (s ? `${s.kind}:${s.index}${s.paint !== undefined ? `@${s.paint}` : ''}` : '');
const rangeStr = (t) => (t ? `${t.start}-${t.end}` : '');

export function sourceBindingIdentity(r) {
  if (!r?.variable?.key) throw new BindingIdentityError('missing stable variable key — captureId is not promotable identity (§6.1)');
  for (const [fact, v] of [
    ['variable.collectionKey', r.variable.collectionKey], ['source.fileKey', r.source?.fileKey],
    ['source.nodeId', r.source?.nodeId], ['source.propertyPath', r.source?.propertyPath],
    ['modeContextId', r.modeContextId], ['resolutionTraceId', r.resolutionTraceId],
    ['destinationDomain', r.destinationDomain], ['emissionTarget', r.emissionTarget],
  ]) {
    if (!v) throw new BindingIdentityError(`missing identity fact ${fact} — identity facts never coalesce to empty (G2)`);
  }
  if (invalidPointer(r.source.propertyPath)) {
    throw new BindingIdentityError(`propertyPath must be a VALID RFC6901 JSON Pointer (~ only as ~0/~1; got ${r.source.propertyPath})`);
  }
  return [
    r.variable.key, r.variable.collectionKey, r.source.fileKey,
    r.source.nodeId, r.source.propertyPath, slotStr(r.source.slot), rangeStr(r.source.textRange),
    r.modeContextId, r.destinationDomain, r.emissionTarget,
  ].join('␟');
}

export function emittedBindingIdentity(r, channelId) {
  if (!channelId) throw new BindingIdentityError('missing registry channelId — emitted conservation requires the resolved channel (G2)');
  return `${sourceBindingIdentity(r)}␟${channelId}`;
}

/** G3 trace conservation: the resolution trace rides its own key so a re-resolved chain
 *  (same value, different route) cannot silently substitute (§3.5 mode-graph law). */
export function traceConservationKey(r) {
  return `${sourceBindingIdentity(r)}␟trace:${r.resolutionTraceId}`;
}

export function formatBindingForError(r) {
  const key = r?.variable?.key ?? `⚠capture-id:${r?.variable?.captureId ?? '?'}`;
  return `${key} @ ${r?.source?.nodeId ?? '?'}/${r?.source?.propertyPath ?? '?'}${slotStr(r?.source?.slot) ? ` [${slotStr(r.source.slot)}]` : ''}`;
}

export class BindingIdentityError extends Error {}
