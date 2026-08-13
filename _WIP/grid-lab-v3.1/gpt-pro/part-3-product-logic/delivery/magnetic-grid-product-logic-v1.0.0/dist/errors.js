export class ProductLogicInputError extends Error {
    code;
    path;
    constructor(code, path, message) {
        super(`${code} at ${path}: ${message}`);
        this.name = "ProductLogicInputError";
        this.code = code;
        this.path = path;
    }
}
export class NonTierableOrderingError extends Error {
    code = "NON_TIERABLE_ORDERING";
    candidateRefs;
    constructor(candidateRefs, message) {
        super(`NON_TIERABLE_ORDERING for ${candidateRefs.join(", ")}: ${message}`);
        this.name = "NonTierableOrderingError";
        this.candidateRefs = candidateRefs;
    }
}
