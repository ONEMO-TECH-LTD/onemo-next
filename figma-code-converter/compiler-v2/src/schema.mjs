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

/** Minimal structural validators — fail loud with the exact missing path. */
export function validateManifest(m) {
  const e = schemaError('manifest', m);
  if (e) return [e];
  const errs = [];
  for (const k of ['fileKey', 'fileVersion', 'rootIds', 'captureId', 'files', 'census', 'sourcePlanes', 'compilerVersion', 'capabilityRegistryVersion']) {
    if (m[k] === undefined) errs.push(`manifest.${k} missing`);
  }
  if (m.files && !Object.values(m.files).every((f) => f?.sha256 && Number.isInteger(f?.bytes))) {
    errs.push('manifest.files entries need {sha256, bytes}');
  }
  return errs;
}

export function validateBindingRecord(r) {
  const e = schemaError('bindingRecord', r);
  if (e) return [e];
  const errs = [];
  if (!r.bindingId) errs.push('bindingId missing');
  if (!r.source?.nodeId || !r.source?.propertyPath) errs.push('source.nodeId/propertyPath missing');
  if (r.source?.slot && !SLOT_KINDS.includes(r.source.slot.kind)) errs.push(`slot.kind ${r.source.slot.kind} invalid`);
  if (!r.variable?.key) errs.push('variable.key (stable) missing — hard-fail per §6.1, captureId is not identity');
  if (!r.variable?.captureId) errs.push('variable.captureId missing');
  if (!r.variable?.figmaType) errs.push('variable.figmaType missing');
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
  return [
    r.variable.key, r.variable.collectionKey ?? '', r.source.fileKey ?? '',
    r.source.nodeId, r.source.propertyPath, slotStr(r.source.slot), rangeStr(r.source.textRange),
    r.modeContextId ?? '', r.destinationDomain, r.emissionTarget,
  ].join('␟');
}

export function emittedBindingIdentity(r, channelId) {
  if (!channelId) throw new BindingIdentityError('missing registry channelId — emitted conservation requires the resolved channel (G2)');
  return `${sourceBindingIdentity(r)}␟${channelId}`;
}

export function formatBindingForError(r) {
  const key = r?.variable?.key ?? `⚠capture-id:${r?.variable?.captureId ?? '?'}`;
  return `${key} @ ${r?.source?.nodeId ?? '?'}/${r?.source?.propertyPath ?? '?'}${slotStr(r?.source?.slot) ? ` [${slotStr(r.source.slot)}]` : ''}`;
}

export class BindingIdentityError extends Error {}
