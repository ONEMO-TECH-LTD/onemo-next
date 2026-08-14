import { buildOrdering } from "./order.js";
import { buildCandidateEvaluation, validateInput } from "./validate.js";
/**
 * Applies only caller-supplied product judgements and precedence to the complete
 * accepted candidate set. It performs no geometry and creates no candidates.
 */
export function applyProductLogic(input) {
    const validated = validateInput(input);
    const evaluations = validated.candidates.map((candidate) => buildCandidateEvaluation(candidate, validated.rules));
    const ordering = buildOrdering(validated.candidates, validated.rules);
    const escalationDefinition = validated.rules.escalation === undefined
        ? { kind: "not-supplied" }
        : { kind: "supplied", ...validated.rules.escalation };
    const statusDefinition = validated.rules.statusPolicy === undefined
        ? { kind: "not-supplied" }
        : {
            kind: "supplied",
            policyId: validated.rules.statusPolicy.policyId,
            definition: validated.rules.statusPolicy.definition,
        };
    return {
        schema: "magnetic-grid-product-logic/result/v1",
        sourceCandidateSchema: "magnetic-grid-candidate-enumerator/candidates/v1",
        sourceMeasurementSchema: "magnetic-grid-measurement-kernel/lattice/v1",
        candidateDocument: validated.candidateDocument,
        ruleDefinitions: {
            gravity: validated.rules.gravity,
            tightWrap: validated.rules.tightWrap,
            regionalSupport: validated.rules.regionalSupport,
            bands: validated.rules.bands,
            escalation: escalationDefinition,
            statusPolicy: statusDefinition,
        },
        evaluations,
        ordering: {
            tiers: ordering.tiers,
            boundaries: ordering.boundaries,
            serializationOrderWithinTier: "source-candidate-order-only",
        },
    };
}
