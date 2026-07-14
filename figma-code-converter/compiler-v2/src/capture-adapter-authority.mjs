/** C11 v3 §4.5 static read-only adapter audit plus externally trusted Ed25519 receipt. */
import { createPublicKey, verify } from 'node:crypto';
import ts from 'typescript';
import { canonicalJson, sha256 } from './evidence.mjs';

const HASH = /^[0-9a-f]{64}$/;
const ID = /^[a-z][a-z0-9-]{2,63}$/;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const RECEIPT_FIELDS = ['authorityId', 'bundleHash', 'expiresAt', 'issuedAt', 'kind', 'schemaVersion', 'scope', 'staticAuditHash'];
const RECEIPT_BODY_FIELDS = [...RECEIPT_FIELDS].sort().join(',');
const SIGNED_FIELDS = [...RECEIPT_FIELDS, 'signature'].sort().join(',');
const AUTHORITY_FIELDS = ['authorityId', 'publicKeyPem'].sort().join(',');
const MAX_BUNDLE_BYTES = 500_000;

const FORBIDDEN_PROPERTIES = new Set([
  '__proto__', 'prototype', 'constructor',
  'assign', 'defineProperty', 'defineProperties', 'setPrototypeOf',
  'createRectangle', 'createFrame', 'createText', 'createComponent', 'createComponentFromNode',
  'createComponentSet', 'combineAsVariants', 'createPage', 'createSection', 'createSlice',
  'createVector', 'createStar', 'createLine', 'createEllipse', 'createPolygon',
  'createBooleanOperation', 'createNodeFromSvg',
  'importComponentByKeyAsync', 'importStyleByKeyAsync', 'importVariableByKeyAsync',
  'appendChild', 'insertChild', 'remove', 'resize', 'resizeWithoutConstraints', 'rescale',
  'setPluginData', 'setSharedPluginData', 'setRelaunchData', 'setBoundVariable',
  'setExplicitVariableModeForCollection', 'clearExplicitVariableModeForCollection',
  'detachInstance', 'swapComponent', 'setProperties', 'group', 'ungroup', 'flatten',
  'union', 'subtract', 'intersect', 'exclude', 'commitUndo',
  'fetch', 'sendBeacon', 'open', 'send', 'writeFile', 'writeFileSync',
]);
const FORBIDDEN_IDENTIFIERS = new Set([
  'require', 'eval', 'Function', 'AsyncFunction', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'process', 'Deno', 'Bun', 'globalThis', 'window', 'self', 'document', 'navigator', 'location', 'Reflect',
]);
const MUTATING_CALL_PREFIX = /^(?:add|append|clone|combine|commit|create|delete|detach|edit|exclude|flatten|group|import|insert|intersect|move|publish|remove|rescale|reset|resize|save|set|subtract|swap|union|ungroup|write)/;

export class CaptureAdapterAuthorityError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_CAPTURE'; }
}

export function auditCaptureAdapterBundle({ bundleBytes, entryFile }) {
  if (!Buffer.isBuffer(bundleBytes) || bundleBytes.length < 1 || bundleBytes.length > MAX_BUNDLE_BYTES) throw new CaptureAdapterAuthorityError('adapter bundle bytes missing or exceed limit');
  if (!validEntry(entryFile)) throw new CaptureAdapterAuthorityError('adapter entry path invalid');
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bundleBytes); }
  catch { throw new CaptureAdapterAuthorityError('adapter bundle must be valid NUL-free UTF-8'); }
  if (source.includes('\0')) throw new CaptureAdapterAuthorityError('adapter bundle must be valid NUL-free UTF-8');
  const file = ts.createSourceFile(entryFile, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length) throw new CaptureAdapterAuthorityError(`adapter syntax invalid: ${formatDiagnostic(file, file.parseDiagnostics[0])}`);
  const calls = new Set();
  const properties = new Set();
  let factory = null;

  const refuse = (node, reason) => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    throw new CaptureAdapterAuthorityError(`${reason} at ${entryFile}:${line + 1}:${character + 1}`);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) refuse(node, 'adapter imports are forbidden');
    if (node.kind === ts.SyntaxKind.WithStatement) refuse(node, 'with/dynamic scope is forbidden');
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'createCaptureAdapter') {
      if (factory) refuse(node, 'duplicate createCaptureAdapter factory');
      const exported = node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported || node.parameters.length !== 1 || !ts.isIdentifier(node.parameters[0].name) || node.parameters[0].name.text !== 'figma') refuse(node, 'createCaptureAdapter must be one exported function with only the figma capability parameter');
      factory = node;
    }
    if (ts.isElementAccessExpression(node)) refuse(node, 'computed property access is forbidden');
    if (ts.isDeleteExpression(node)) refuse(node, 'property deletion is forbidden');
    if (ts.isBinaryExpression(node) && isAssignment(node.operatorToken.kind)) {
      if (containsPropertyTarget(node.left)) refuse(node, 'property writes are forbidden');
      if (ts.isIdentifier(node.left) && node.left.text === 'figma') refuse(node, 'figma capability reassignment is forbidden');
    }
    const propertyUpdate = (ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator))
      || ts.isPostfixUnaryExpression(node);
    if (propertyUpdate && (ts.isPropertyAccessExpression(node.operand) || ts.isElementAccessExpression(node.operand))) refuse(node, 'property updates are forbidden');
    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;
      const full = propertyChain(node);
      properties.add(full);
      if (FORBIDDEN_PROPERTIES.has(name)) refuse(node, `forbidden mutation/runtime property ${name}`);
    }
    if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text) && !isNonComputedPropertyName(node)) refuse(node, `forbidden runtime identifier ${node.text}`);
    if (ts.isIdentifier(node) && node.text === 'figma' && !isFigmaParameter(node) && (!(ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) || !isDescendantOf(node, factory))) refuse(node, 'figma capability may only be read through direct named properties inside its factory');
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) refuse(node, 'dynamic import is forbidden');
      const name = callableName(node.expression);
      if (!name) refuse(node, 'dynamic call target is forbidden');
      if (ts.isIdentifier(node.expression)) refuse(node, `unresolved identifier call ${name} is forbidden`);
      calls.add(name);
      const leaf = name.split('.').at(-1);
      if (FORBIDDEN_IDENTIFIERS.has(leaf) || FORBIDDEN_PROPERTIES.has(leaf) || MUTATING_CALL_PREFIX.test(leaf)) refuse(node, `forbidden call ${name}`);
    }
    if (ts.isNewExpression(node)) {
      const name = callableName(node.expression);
      if (!name || FORBIDDEN_IDENTIFIERS.has(name.split('.').at(-1))) refuse(node, `forbidden constructor ${name ?? 'dynamic'}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  if (!factory) throw new CaptureAdapterAuthorityError('adapter must export createCaptureAdapter(figma)');
  const body = {
    schemaVersion: 1,
    proofClass: 'capture-adapter-static-audit',
    entryFile,
    parser: `typescript@${ts.version}`,
    bundleHash: sha256(bundleBytes),
    calls: [...calls].sort(),
    properties: [...properties].sort(),
    forbiddenCalls: [],
    imports: [],
    dynamicAccess: false,
    propertyWrites: 0,
  };
  return { ...body, staticAuditHash: sha256(canonicalJson(body)) };
}

export function adapterReceiptPayload(receiptBody) {
  validateReceiptBody(receiptBody);
  return Buffer.from(canonicalJson(receiptBody));
}

export function verifyCaptureAdapterAuthority({ bundleBytes, audit, receipt, authority, now }) {
  const expectedAudit = auditCaptureAdapterBundle({ bundleBytes, entryFile: audit?.entryFile });
  if (canonicalJson(audit) !== canonicalJson(expectedAudit)) throw new CaptureAdapterAuthorityError('adapter static audit does not match independently parsed bundle bytes');
  const normalized = normalizeAuthority(authority);
  validateSignedReceipt(receipt);
  const { signature, ...body } = receipt;
  validateReceiptBody(body);
  if (body.authorityId !== normalized.authorityId || body.bundleHash !== audit.bundleHash || body.staticAuditHash !== audit.staticAuditHash) throw new CaptureAdapterAuthorityError('adapter receipt identity/hash does not match trusted authority and audit');
  const instant = parseInstant(now, 'verification time');
  const issued = parseInstant(body.issuedAt, 'receipt issuedAt');
  const expires = parseInstant(body.expiresAt, 'receipt expiresAt');
  if (expires <= issued || expires - issued > 7 * 24 * 60 * 60 * 1000) throw new CaptureAdapterAuthorityError('adapter receipt validity window invalid or exceeds seven days');
  if (instant < issued) throw new CaptureAdapterAuthorityError('adapter receipt is not yet valid');
  if (instant > expires) throw new CaptureAdapterAuthorityError('adapter receipt expired');
  const signatureBytes = Buffer.from(signature, 'base64');
  if (!verify(null, adapterReceiptPayload(body), normalized.key, signatureBytes)) throw new CaptureAdapterAuthorityError('adapter authority signature invalid');
  const proof = {
    schemaVersion: 1,
    proofClass: 'capture-adapter-authority',
    adapterKind: 'dedicated-read-only-plugin',
    bundleHash: audit.bundleHash,
    staticAuditHash: audit.staticAuditHash,
    authorityId: normalized.authorityId,
    authorityScope: body.scope,
    publicKeyHash: normalized.publicKeyHash,
    receiptHash: sha256(canonicalJson(receipt)),
    verifiedAt: new Date(instant).toISOString(),
    forbiddenCalls: [],
    dynamicAccess: false,
  };
  assertAdapterAuthorityProof(proof, { bundleBytes, audit, receipt, authority, now });
  return proof;
}

export function assertAdapterAuthorityProof(proof, context) {
  if (!plain(proof) || proof.schemaVersion !== 1 || proof.proofClass !== 'capture-adapter-authority' || proof.adapterKind !== 'dedicated-read-only-plugin'
    || !HASH.test(proof.bundleHash ?? '') || !HASH.test(proof.staticAuditHash ?? '') || !HASH.test(proof.publicKeyHash ?? '') || !HASH.test(proof.receiptHash ?? '')
    || !ID.test(proof.authorityId ?? '') || !['diagnostic', 'integration'].includes(proof.authorityScope)
    || !validIso(proof.verifiedAt) || !Array.isArray(proof.forbiddenCalls) || proof.forbiddenCalls.length || proof.dynamicAccess !== false) throw new CaptureAdapterAuthorityError('adapter authority proof malformed');
  const expected = verifyProofInputs(context);
  for (const key of ['bundleHash', 'staticAuditHash', 'authorityId', 'authorityScope', 'publicKeyHash', 'receiptHash', 'verifiedAt']) if (proof[key] !== expected[key]) throw new CaptureAdapterAuthorityError(`adapter authority proof ${key} mismatch`);
  return true;
}

export function composeCaptureAudit({
  authorityProof, bundleBytes, audit, receipt, authority, now,
  transactionId, observerStartedAt, observerStoppedAt, documentChangeEvents,
}) {
  assertAdapterAuthorityProof(authorityProof, { bundleBytes, audit, receipt, authority, now });
  if (!ID.test(transactionId ?? '') || !validIso(observerStartedAt) || !validIso(observerStoppedAt) || Date.parse(observerStoppedAt) < Date.parse(observerStartedAt)) throw new CaptureAdapterAuthorityError('runtime documentchange observer identity/window invalid');
  if (Date.parse(observerStartedAt) < Date.parse(authorityProof.verifiedAt)) throw new CaptureAdapterAuthorityError('runtime documentchange observer cannot precede adapter authority verification');
  const endAuthority = verifyProofInputs({ bundleBytes, audit, receipt, authority, now: observerStoppedAt });
  for (const key of ['bundleHash', 'staticAuditHash', 'authorityId', 'authorityScope', 'publicKeyHash', 'receiptHash']) {
    if (authorityProof[key] !== endAuthority[key]) throw new CaptureAdapterAuthorityError(`adapter authority changed during capture: ${key}`);
  }
  if (!Array.isArray(documentChangeEvents) || documentChangeEvents.length) throw new CaptureAdapterAuthorityError('runtime documentchange evidence is nonzero or malformed');
  return {
    adapterKind: authorityProof.adapterKind,
    bundleHash: authorityProof.bundleHash,
    staticAuditHash: authorityProof.staticAuditHash,
    authorityId: authorityProof.authorityId,
    authorityScope: authorityProof.authorityScope,
    authorityReceiptHash: authorityProof.receiptHash,
    authorityVerifiedAt: authorityProof.verifiedAt,
    transactionId,
    observerStartedAt,
    observerStoppedAt,
    forbiddenCalls: [],
    dynamicAccess: false,
    documentChangeEvents: [],
  };
}

function verifyProofInputs({ bundleBytes, audit, receipt, authority, now }) {
  const expectedAudit = auditCaptureAdapterBundle({ bundleBytes, entryFile: audit?.entryFile });
  if (canonicalJson(audit) !== canonicalJson(expectedAudit)) throw new CaptureAdapterAuthorityError('adapter audit mismatch');
  const normalized = normalizeAuthority(authority);
  validateSignedReceipt(receipt);
  const { signature, ...body } = receipt;
  validateReceiptBody(body);
  const instant = parseInstant(now, 'verification time');
  const issued = parseInstant(body.issuedAt, 'receipt issuedAt');
  const expires = parseInstant(body.expiresAt, 'receipt expiresAt');
  if (body.authorityId !== normalized.authorityId || body.bundleHash !== expectedAudit.bundleHash || body.staticAuditHash !== expectedAudit.staticAuditHash) throw new CaptureAdapterAuthorityError('adapter receipt identity/hash does not match trusted authority and audit');
  if (expires <= issued || expires - issued > 7 * 24 * 60 * 60 * 1000) throw new CaptureAdapterAuthorityError('adapter receipt validity window invalid or exceeds seven days');
  if (instant < issued || instant > expires) throw new CaptureAdapterAuthorityError('adapter receipt expired or not yet valid');
  if (!verify(null, adapterReceiptPayload(body), normalized.key, Buffer.from(signature, 'base64'))) throw new CaptureAdapterAuthorityError('adapter authority signature invalid');
  return {
    bundleHash: expectedAudit.bundleHash,
    staticAuditHash: expectedAudit.staticAuditHash,
    authorityId: normalized.authorityId,
    authorityScope: body.scope,
    publicKeyHash: normalized.publicKeyHash,
    receiptHash: sha256(canonicalJson(receipt)),
    verifiedAt: new Date(instant).toISOString(),
  };
}

function normalizeAuthority(authority) {
  if (!plain(authority) || Object.keys(authority).sort().join(',') !== AUTHORITY_FIELDS || !ID.test(authority.authorityId ?? '') || typeof authority.publicKeyPem !== 'string') throw new CaptureAdapterAuthorityError('adapter authority must contain public verification fields only');
  let key;
  try { key = createPublicKey(authority.publicKeyPem); }
  catch (error) { throw new CaptureAdapterAuthorityError(`adapter public key malformed: ${error.message}`); }
  if (key.asymmetricKeyType !== 'ed25519') throw new CaptureAdapterAuthorityError('adapter authority requires an Ed25519 public key');
  const der = key.export({ type: 'spki', format: 'der' });
  return { key, authorityId: authority.authorityId, publicKeyHash: sha256(der) };
}

function validateReceiptBody(body) {
  if (!plain(body) || Object.keys(body).sort().join(',') !== RECEIPT_BODY_FIELDS || body.schemaVersion !== 1 || body.kind !== 'capture-adapter-authority'
    || !ID.test(body.authorityId ?? '') || !['diagnostic', 'integration'].includes(body.scope) || !HASH.test(body.bundleHash ?? '') || !HASH.test(body.staticAuditHash ?? '')
    || !validIso(body.issuedAt) || !validIso(body.expiresAt)) throw new CaptureAdapterAuthorityError('adapter receipt body malformed');
}

function validateSignedReceipt(receipt) {
  if (!plain(receipt) || Object.keys(receipt).sort().join(',') !== SIGNED_FIELDS || !BASE64.test(receipt.signature ?? '') || Buffer.from(receipt.signature ?? '', 'base64').length !== 64) throw new CaptureAdapterAuthorityError('signed adapter receipt malformed');
}

function callableName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return propertyChain(expression);
  if (ts.isParenthesizedExpression(expression)) return callableName(expression.expression);
  return null;
}

function propertyChain(node) {
  const parts = [node.name.text];
  let current = node.expression;
  while (ts.isPropertyAccessExpression(current)) { parts.unshift(current.name.text); current = current.expression; }
  if (ts.isIdentifier(current)) parts.unshift(current.text);
  else parts.unshift('<expression>');
  return parts.join('.');
}

function isFigmaParameter(node) {
  return ts.isParameter(node.parent) && node.parent.name === node && ts.isFunctionDeclaration(node.parent.parent)
    && node.parent.parent.name?.text === 'createCaptureAdapter' && node.parent.parent.parent.kind === ts.SyntaxKind.SourceFile;
}

function isNonComputedPropertyName(node) {
  const parent = node.parent;
  return (ts.isPropertyAccessExpression(parent) && parent.name === node)
    || ((ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isMethodSignature(parent)
      || ts.isPropertyDeclaration(parent) || ts.isPropertySignature(parent)) && parent.name === node);
}

function isAssignment(kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function containsPropertyTarget(node) {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => { if (!found && containsPropertyTarget(child)) found = true; });
  return found;
}

function isDescendantOf(node, ancestor) {
  if (!ancestor) return false;
  for (let current = node.parent; current; current = current.parent) if (current === ancestor) return true;
  return false;
}

function formatDiagnostic(file, diagnostic) {
  const position = diagnostic.start ?? 0;
  const { line, character } = file.getLineAndCharacterOfPosition(position);
  return `${line + 1}:${character + 1} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`;
}

function parseInstant(value, label) {
  if (!validIso(value)) throw new CaptureAdapterAuthorityError(`${label} invalid`);
  return Date.parse(value);
}

const validIso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const validEntry = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:m?js|cjs)$/.test(value) && !value.includes('..') && !value.includes('\\') && !value.startsWith('/');
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
