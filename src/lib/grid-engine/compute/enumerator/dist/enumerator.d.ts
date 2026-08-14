import type { CandidateEnumerationDocumentJson, EnumerateCandidatesInput } from "./types.js";
/**
 * Enumerates only the four supplied arrangement families from exact kernel facts.
 * No geometric predicate, selection, score, ranking, pruning or winner exists here.
 */
export declare function enumerateCandidates(input: EnumerateCandidatesInput): CandidateEnumerationDocumentJson;
