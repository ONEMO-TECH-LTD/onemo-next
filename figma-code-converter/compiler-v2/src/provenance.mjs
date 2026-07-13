/** Per-fact provenance gate shared by P2 graph parsers. Pure; callers own failure taxonomy. */
export function graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families }) {
  if (!sourcePlanes || typeof sourcePlanes !== 'object' || Array.isArray(sourcePlanes)) {
    return ['per-fact source planes missing'];
  }
  const expected = evidenceClass === 'microfixture'
    ? 'fixture'
    : evidenceClass === 'integration'
      ? 'plugin-primary-complete'
      : null;
  if (!expected) return [`unknown evidence class ${evidenceClass ?? 'missing'}`];
  return families
    .filter((family) => sourcePlanes[family] !== expected)
    .map((family) => `${family}=${sourcePlanes[family] ?? 'missing'} (need ${expected})`);
}
