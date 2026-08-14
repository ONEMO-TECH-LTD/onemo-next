import { ProductLogicInputError } from "./errors.js";
const CANONICAL_INTEGER = /^(?:0|-?[1-9][0-9]*)$/;
const CANONICAL_NONNEGATIVE_INTEGER = /^(?:0|[1-9][0-9]*)$/;
export function parseDecimalInteger(value, path) {
    if (typeof value !== "string" || !CANONICAL_INTEGER.test(value)) {
        throw new ProductLogicInputError("INVALID_CANONICAL_INTEGER", path, "expected a canonical base-10 integer string");
    }
    return BigInt(value);
}
export function parseNonnegativeDecimalInteger(value, path) {
    if (typeof value !== "string" || !CANONICAL_NONNEGATIVE_INTEGER.test(value)) {
        throw new ProductLogicInputError("INVALID_CANONICAL_INTEGER", path, "expected a canonical non-negative base-10 integer string");
    }
    return BigInt(value);
}
export function validateRational(value, path) {
    if (!isRecord(value)) {
        throw new ProductLogicInputError("INVALID_RATIONAL", path, "expected an object");
    }
    assertExactKeys(value, ["denominator", "numerator"], path);
    const numerator = parseDecimalInteger(value.numerator, `${path}.numerator`);
    const denominator = parseDecimalInteger(value.denominator, `${path}.denominator`);
    if (denominator <= 0n) {
        throw new ProductLogicInputError("INVALID_RATIONAL", `${path}.denominator`, "denominator must be positive");
    }
    return {
        numerator: numerator.toString(),
        denominator: denominator.toString(),
    };
}
export function compareRational(left, right) {
    const leftNumerator = BigInt(left.numerator);
    const leftDenominator = BigInt(left.denominator);
    const rightNumerator = BigInt(right.numerator);
    const rightDenominator = BigInt(right.denominator);
    const leftCross = leftNumerator * rightDenominator;
    const rightCross = rightNumerator * leftDenominator;
    return leftCross < rightCross ? -1 : leftCross > rightCross ? 1 : 0;
}
/** Returns -1 when left is better, +1 when right is better, 0 when tied. */
export function compareOrderedValue(left, right, comparator) {
    if (comparator.kind === "exact-rational") {
        if (left.kind !== "exact-rational" || right.kind !== "exact-rational") {
            throw new Error("internal invariant: rational comparator/value mismatch");
        }
        const raw = compareRational(left.value, right.value);
        if (raw === 0) {
            return 0;
        }
        if (comparator.direction === "lower-is-better") {
            return raw;
        }
        return raw === -1 ? 1 : -1;
    }
    if (left.kind !== "ordered-class" || right.kind !== "ordered-class") {
        throw new Error("internal invariant: class comparator/value mismatch");
    }
    const leftIndex = comparator.bestToWorst.indexOf(left.value);
    const rightIndex = comparator.bestToWorst.indexOf(right.value);
    if (leftIndex < 0 || rightIndex < 0) {
        throw new Error("internal invariant: validated class missing from definition");
    }
    return leftIndex < rightIndex ? -1 : leftIndex > rightIndex ? 1 : 0;
}
export function validateExactJson(value, path) {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((item, index) => validateExactJson(item, `${path}[${index}]`));
    }
    if (isRecord(value)) {
        const output = {};
        for (const key of Object.keys(value).sort()) {
            const member = value[key];
            if (member === undefined) {
                throw new ProductLogicInputError("INVALID_EXACT_JSON", `${path}.${key}`, "undefined is not exact JSON");
            }
            output[key] = validateExactJson(member, `${path}.${key}`);
        }
        return output;
    }
    throw new ProductLogicInputError("INVALID_EXACT_JSON", path, "expected null, boolean, string, array, or object; JavaScript number and BigInt are forbidden");
}
export function validateOrderedComparator(value, path) {
    if (!isRecord(value)) {
        throw new ProductLogicInputError("INVALID_RULE_VALUE", path, "expected an object");
    }
    if (value.kind === "exact-rational") {
        assertExactKeys(value, ["direction", "kind"], path);
        if (value.direction !== "higher-is-better" && value.direction !== "lower-is-better") {
            throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.direction`, "expected higher-is-better or lower-is-better");
        }
        return { kind: "exact-rational", direction: value.direction };
    }
    if (value.kind === "ordered-classes") {
        assertExactKeys(value, ["bestToWorst", "kind"], path);
        if (!Array.isArray(value.bestToWorst) || value.bestToWorst.length === 0) {
            throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.bestToWorst`, "expected a non-empty array");
        }
        const seen = new Set();
        const classes = [];
        value.bestToWorst.forEach((item, index) => {
            const className = nonemptyString(item, `${path}.bestToWorst[${index}]`);
            if (seen.has(className)) {
                throw new ProductLogicInputError("DUPLICATE_INPUT", `${path}.bestToWorst[${index}]`, `duplicate class ${JSON.stringify(className)}`);
            }
            seen.add(className);
            classes.push(className);
        });
        return { kind: "ordered-classes", bestToWorst: classes };
    }
    throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.kind`, "expected exact-rational or ordered-classes");
}
export function validateOrderedValue(value, comparator, path) {
    if (!isRecord(value)) {
        throw new ProductLogicInputError("INVALID_RULE_VALUE", path, "expected an object");
    }
    if (comparator.kind === "exact-rational") {
        assertExactKeys(value, ["kind", "value"], path);
        if (value.kind !== "exact-rational") {
            throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.kind`, "must match exact-rational comparator");
        }
        return { kind: "exact-rational", value: validateRational(value.value, `${path}.value`) };
    }
    assertExactKeys(value, ["kind", "value"], path);
    if (value.kind !== "ordered-class") {
        throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.kind`, "must match ordered-classes comparator");
    }
    const className = nonemptyString(value.value, `${path}.value`);
    if (!comparator.bestToWorst.includes(className)) {
        throw new ProductLogicInputError("INVALID_RULE_VALUE", `${path}.value`, `class ${JSON.stringify(className)} is absent from comparator.bestToWorst`);
    }
    return { kind: "ordered-class", value: className };
}
export function nonemptyString(value, path) {
    if (typeof value !== "string" || value.length === 0) {
        throw new ProductLogicInputError("INVALID_INPUT", path, "expected a non-empty string");
    }
    return value;
}
export function assertExactKeys(value, expected, path) {
    const actual = Object.keys(value).sort();
    const wanted = [...expected].sort();
    if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
        throw new ProductLogicInputError("INVALID_INPUT", path, `expected exactly keys ${wanted.join(", ")}; received ${actual.join(", ")}`);
    }
}
export function isRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
export function assertAllowedKeys(value, required, optional, path) {
    const allowed = new Set([...required, ...optional]);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            throw new ProductLogicInputError("INVALID_INPUT", `${path}.${key}`, "unknown member would be ignored; explicit product-rule objects reject unknown keys");
        }
    }
    for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            throw new ProductLogicInputError("MISSING_INPUT", `${path}.${key}`, "required member is missing");
        }
    }
}
