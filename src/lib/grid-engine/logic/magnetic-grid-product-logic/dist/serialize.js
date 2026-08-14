/**
 * Deterministic exact JSON serializer. Object keys are lexicographic; arrays
 * preserve schema order. JavaScript number and BigInt are forbidden.
 */
export function serializeCanonical(value) {
    return write(value);
}
function write(value) {
    if (value === null) {
        return "null";
    }
    switch (typeof value) {
        case "boolean":
            return value ? "true" : "false";
        case "string":
            return JSON.stringify(value);
        case "number":
            throw new TypeError("canonical exact JSON requires numeric data to be encoded as strings");
        case "bigint":
            throw new TypeError("canonical output must not expose BigInt values");
        case "undefined":
        case "function":
        case "symbol":
            throw new TypeError(`canonical JSON does not support ${typeof value}`);
        case "object":
            if (Array.isArray(value)) {
                const members = [];
                for (let index = 0; index < value.length; index += 1) {
                    if (!Object.prototype.hasOwnProperty.call(value, index)) {
                        throw new TypeError(`canonical JSON array member ${index} is absent`);
                    }
                    members.push(write(value[index]));
                }
                return `[${members.join(",")}]`;
            }
            if (!isPlainRecord(value)) {
                throw new TypeError("canonical JSON supports only plain objects");
            }
            if (Object.getOwnPropertySymbols(value).length !== 0) {
                throw new TypeError("canonical JSON does not support symbol-keyed members");
            }
            return writeObject(value);
    }
    throw new TypeError("canonical JSON encountered an unsupported value");
}
function writeObject(value) {
    const keys = Object.keys(value).sort();
    return `{${keys
        .map((key) => {
        const member = value[key];
        if (member === undefined) {
            throw new TypeError(`canonical JSON object member ${JSON.stringify(key)} is undefined`);
        }
        return `${JSON.stringify(key)}:${write(member)}`;
    })
        .join(",")}}`;
}
function isPlainRecord(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
