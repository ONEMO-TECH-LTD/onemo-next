export class KernelInputError extends Error {
    code;
    path;
    constructor(code, path, message) {
        super(`${code} at ${path}: ${message}`);
        this.name = "KernelInputError";
        this.code = code;
        this.path = path;
    }
}
