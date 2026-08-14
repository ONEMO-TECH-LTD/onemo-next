import { serializeCanonical } from "./serialize.js";
/**
 * Collision-free canonical identity. The suffix is the canonical JSON identity itself,
 * not a hash, so no encoding, floating-point or collision assumption enters identity.
 */
export function makeCandidateId(identity) {
    return `candidate:v1:${serializeCanonical(identity)}`;
}
