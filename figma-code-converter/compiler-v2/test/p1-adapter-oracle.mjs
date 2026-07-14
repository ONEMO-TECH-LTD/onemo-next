/** Independent receipt/proof verifier. Does not import the adapter auditor. */
import { createPublicKey, verify } from 'node:crypto';
import { canonicalJson, sha256 } from '../src/evidence.mjs';

const HASH = /^[0-9a-f]{64}$/;

export function p1AdapterAuthorityFailures({ proof, bundleBytes, audit, receipt, authority, now }) {
  const failures = [];
  if (!plain(proof) || proof.schemaVersion !== 1 || proof.proofClass !== 'capture-adapter-authority' || proof.adapterKind !== 'dedicated-read-only-plugin') return ['proof shape'];
  const bundleHash = sha256(bundleBytes);
  if (proof.bundleHash !== bundleHash || audit?.bundleHash !== bundleHash) failures.push('bundle hash');
  const { staticAuditHash, ...auditBody } = audit ?? {};
  if (!HASH.test(staticAuditHash ?? '') || staticAuditHash !== sha256(canonicalJson(auditBody)) || proof.staticAuditHash !== staticAuditHash) failures.push('audit hash');
  if (proof.forbiddenCalls?.length || proof.dynamicAccess !== false) failures.push('static safety');
  if (receipt?.schemaVersion !== 1 || receipt?.kind !== 'capture-adapter-authority' || !['diagnostic', 'integration'].includes(receipt?.scope)) failures.push('receipt shape');
  if (proof.authorityId !== authority?.authorityId || receipt?.authorityId !== authority?.authorityId || proof.authorityScope !== receipt?.scope || proof.receiptHash !== sha256(canonicalJson(receipt))) failures.push('authority identity');
  if (receipt?.bundleHash !== bundleHash || receipt?.staticAuditHash !== staticAuditHash) failures.push('receipt binding');
  let key;
  try { key = createPublicKey(authority.publicKeyPem); } catch { failures.push('public key'); }
  if (key?.asymmetricKeyType !== 'ed25519') failures.push('key type');
  const publicKeyHash = key ? sha256(key.export({ type: 'spki', format: 'der' })) : null;
  if (proof.publicKeyHash !== publicKeyHash) failures.push('public key hash');
  const { signature, ...body } = receipt ?? {};
  if (!key || !verify(null, Buffer.from(canonicalJson(body)), key, Buffer.from(signature ?? '', 'base64'))) failures.push('signature');
  const instant = Date.parse(now);
  const issued = Date.parse(receipt?.issuedAt);
  const expires = Date.parse(receipt?.expiresAt);
  if (!Number.isFinite(instant) || !Number.isFinite(issued) || !Number.isFinite(expires) || instant < issued || instant > expires || expires <= issued || expires - issued > 7 * 24 * 60 * 60 * 1000) failures.push('validity window');
  if (!Number.isFinite(instant) || proof.verifiedAt !== new Date(instant).toISOString()) failures.push('verification time');
  return [...new Set(failures)];
}

export function p1CaptureRuntimeFailures({ runtime, proof, receipt }) {
  const failures = [];
  if (!plain(runtime) || runtime.adapterKind !== 'dedicated-read-only-plugin') return ['runtime shape'];
  for (const [runtimeKey, proofKey] of [
    ['bundleHash', 'bundleHash'], ['staticAuditHash', 'staticAuditHash'], ['authorityId', 'authorityId'],
    ['authorityScope', 'authorityScope'], ['authorityReceiptHash', 'receiptHash'], ['authorityVerifiedAt', 'verifiedAt'],
  ]) if (runtime[runtimeKey] !== proof?.[proofKey]) failures.push(`runtime ${runtimeKey}`);
  const verified = Date.parse(runtime.authorityVerifiedAt);
  const started = Date.parse(runtime.observerStartedAt);
  const stopped = Date.parse(runtime.observerStoppedAt);
  const expires = Date.parse(receipt?.expiresAt);
  if (![verified, started, stopped, expires].every(Number.isFinite) || started < verified || stopped < started || stopped > expires) failures.push('runtime authority/observer order');
  if (!Array.isArray(runtime.forbiddenCalls) || runtime.forbiddenCalls.length || runtime.dynamicAccess !== false
    || !Array.isArray(runtime.documentChangeEvents) || runtime.documentChangeEvents.length) failures.push('runtime safety');
  return [...new Set(failures)];
}

const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
