/**
 * Deterministic JSON serializer matching the accepted kernel discipline.
 * Object keys are emitted lexicographically; arrays preserve schema order.
 */
export function serializeCanonical(value: unknown): string {
  return write(value);
}

function write(value: unknown): string {
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      throw new TypeError(
        "canonical JSON exact outputs must encode numeric values as decimal strings",
      );
    case "bigint":
      throw new TypeError("canonical JSON outputs must expose BigInt values as decimal strings");
    case "undefined":
    case "function":
    case "symbol":
      throw new TypeError(`canonical JSON does not support ${typeof value}`);
    case "object":
      if (Array.isArray(value)) {
        return `[${value.map((item) => write(item)).join(",")}]`;
      }
      return writeObject(value as Record<string, unknown>);
  }
  throw new TypeError("canonical JSON encountered an unsupported value");
}

function writeObject(value: Record<string, unknown>): string {
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
