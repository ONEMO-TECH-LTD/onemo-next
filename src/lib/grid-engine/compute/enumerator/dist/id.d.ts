import type { CandidateFamily, CandidateStepJson, DecimalInteger } from "./types.js";
interface IdentityPositionJson {
    readonly column: DecimalInteger;
    readonly row: DecimalInteger;
}
interface CandidateIdentityJson {
    readonly family: CandidateFamily;
    readonly population: string;
    readonly steps: CandidateStepJson;
    readonly positions: readonly IdentityPositionJson[];
}
/**
 * Collision-free canonical identity. The suffix is the canonical JSON identity itself,
 * not a hash, so no encoding, floating-point or collision assumption enters identity.
 */
export declare function makeCandidateId(identity: CandidateIdentityJson): string;
export {};
