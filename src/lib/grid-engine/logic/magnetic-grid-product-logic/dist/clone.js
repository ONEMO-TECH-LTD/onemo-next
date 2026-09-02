import { ProductLogicInputError } from "./errors.js";
/** Exact structural clone. Unknown upstream metadata is preserved, not interpreted. */
export function cloneExact(value, path = "value") {
    return clone(value, path);
}
function clone(value, path) {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return value;
    }
    if (Array.isArray(value)) {
        const output = [];
        for (let index = 0; index < value.length; index += 1) {
            if (!Object.prototype.hasOwnProperty.call(value, index)) {
                throw new ProductLogicInputError("INVALID_EXACT_JSON", `${path}[${index}]`, "sparse arrays are not exact JSON");
            }
            output.push(clone(value[index], `${path}[${index}]`));
        }
        return output;
    }
    if (isPlainRecord(value)) {
        if (Object.getOwnPropertySymbols(value).length !== 0) {
            throw new ProductLogicInputError("INVALID_EXACT_JSON", path, "symbol-keyed members are not exact JSON");
        }
        const output = {};
        for (const key of Object.keys(value)) {
            const member = value[key];
            if (member === undefined) {
                throw new ProductLogicInputError("INVALID_EXACT_JSON", `${path}.${key}`, "undefined is not allowed in exact documents");
            }
            output[key] = clone(member, `${path}.${key}`);
        }
        return output;
    }
    throw new ProductLogicInputError("INVALID_EXACT_JSON", path, "documents may contain only exact JSON values; JavaScript number and BigInt are forbidden");
}
function isPlainRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
