import { NonTierableOrderingError } from "./errors.js";
import { compareOrderedValue } from "./exact.js";
export function compareCandidates(left, right, rules) {
    if (left.ref === right.ref) {
        return { relation: "tie" };
    }
    const leftPromotion = promotionFor(left, right.bandId, rules);
    const rightPromotion = promotionFor(right, left.bandId, rules);
    if (leftPromotion !== undefined && rightPromotion !== undefined) {
        throw new NonTierableOrderingError([left.ref, right.ref], "reciprocal escalation directives order each candidate above the other");
    }
    if (leftPromotion !== undefined) {
        return {
            relation: "left-higher",
            decision: escalationDecision(left, right, leftPromotion, rules),
        };
    }
    if (rightPromotion !== undefined) {
        return {
            relation: "right-higher",
            decision: escalationDecision(right, left, rightPromotion, rules),
        };
    }
    for (const stage of baseStages(rules)) {
        const result = compareBaseStage(left, right, stage, rules);
        if (result.relation !== "tie") {
            return result;
        }
    }
    return { relation: "tie" };
}
function promotionFor(candidate, otherBand, rules) {
    return rules.promotionByTargetAndSourceBand.get(`${candidate.ref}\u0000${otherBand}`);
}
function escalationDecision(higher, lower, promotion, rules) {
    const policy = rules.escalation;
    if (policy === undefined) {
        throw new Error("internal invariant: validated promotion requires an escalation policy");
    }
    return {
        rule: "escalation",
        higherCandidateRef: higher.ref,
        lowerCandidateRef: lower.ref,
        policyId: policy.policyId,
        sourceBand: promotion.sourceBand,
        targetBand: promotion.targetBand,
        sourceBandSupportInsufficient: true,
        triggerDefinitionId: promotion.assessment.triggerDefinitionId,
        triggerInput: promotion.assessment.triggerInput,
        strengthDefinitionId: promotion.strengthDefinitionId,
        strengthInput: promotion.strengthInput,
    };
}
function baseStages(rules) {
    switch (rules.regionalSupport.precedence) {
        case "report-only":
            return ["gravity", "tight-wrap"];
        case "before-gravity":
            return ["regional-support", "gravity", "tight-wrap"];
        case "between-gravity-and-tight-wrap":
            return ["gravity", "regional-support", "tight-wrap"];
        case "after-tight-wrap":
            return ["gravity", "tight-wrap", "regional-support"];
    }
}
function compareBaseStage(left, right, stage, rules) {
    if (stage === "gravity") {
        const leftValue = left.judgement.gravity.holdsUpperMaterial;
        const rightValue = right.judgement.gravity.holdsUpperMaterial;
        if (leftValue === rightValue) {
            return { relation: "tie" };
        }
        if (leftValue) {
            return {
                relation: "left-higher",
                decision: {
                    rule: "gravity",
                    higherCandidateRef: left.ref,
                    lowerCandidateRef: right.ref,
                    definitionId: rules.gravity.definitionId,
                    higherValue: { holdsUpperMaterial: true },
                    lowerValue: { holdsUpperMaterial: false },
                },
            };
        }
        return {
            relation: "right-higher",
            decision: {
                rule: "gravity",
                higherCandidateRef: right.ref,
                lowerCandidateRef: left.ref,
                definitionId: rules.gravity.definitionId,
                higherValue: { holdsUpperMaterial: true },
                lowerValue: { holdsUpperMaterial: false },
            },
        };
    }
    if (stage === "tight-wrap") {
        // The product ruling scopes tight wrap to candidates satisfying gravity.
        if (!left.judgement.gravity.holdsUpperMaterial ||
            !right.judgement.gravity.holdsUpperMaterial) {
            return { relation: "tie" };
        }
        const comparison = compareOrderedValue(left.judgement.tightWrap.value, right.judgement.tightWrap.value, rules.tightWrap.comparator);
        if (comparison === 0) {
            return { relation: "tie" };
        }
        const higher = comparison === -1 ? left : right;
        const lower = comparison === -1 ? right : left;
        return {
            relation: comparison === -1 ? "left-higher" : "right-higher",
            decision: {
                rule: "tight-wrap",
                higherCandidateRef: higher.ref,
                lowerCandidateRef: lower.ref,
                definitionId: rules.tightWrap.definitionId,
                comparator: rules.tightWrap.comparator,
                higherValue: higher.judgement.tightWrap.value,
                lowerValue: lower.judgement.tightWrap.value,
            },
        };
    }
    const comparison = compareOrderedValue(left.judgement.regionalSupport.value, right.judgement.regionalSupport.value, rules.regionalSupport.comparator);
    if (comparison === 0) {
        return { relation: "tie" };
    }
    if (rules.regionalSupport.precedence === "report-only") {
        throw new Error("internal invariant: report-only regional support is not an ordering stage");
    }
    const higher = comparison === -1 ? left : right;
    const lower = comparison === -1 ? right : left;
    return {
        relation: comparison === -1 ? "left-higher" : "right-higher",
        decision: {
            rule: "regional-support",
            higherCandidateRef: higher.ref,
            lowerCandidateRef: lower.ref,
            definitionId: rules.regionalSupport.definitionId,
            precedence: rules.regionalSupport.precedence,
            comparator: rules.regionalSupport.comparator,
            higherValue: higher.judgement.regionalSupport.value,
            lowerValue: lower.judgement.regionalSupport.value,
        },
    };
}
