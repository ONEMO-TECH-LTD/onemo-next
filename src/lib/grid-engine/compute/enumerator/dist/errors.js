export class EnumeratorInputError extends Error {
    code;
    path;
    constructor(code, path, message) {
        super(`${path}: ${message}`);
        this.name = "EnumeratorInputError";
        this.code = code;
        this.path = path;
    }
}
export class MissingKernelFactError extends Error {
    sizeIndex;
    column;
    row;
    expectedFact;
    constructor(sizeIndex, column, row) {
        const sizeText = sizeIndex.toString();
        const columnText = column.toString();
        const rowText = row.toString();
        const expectedFact = `/sizes/${sizeText}/positions/<fact at column ${columnText}, row ${rowText}>`;
        super(`kernel document does not publish required fact ${expectedFact}`);
        this.name = "MissingKernelFactError";
        this.sizeIndex = sizeText;
        this.column = columnText;
        this.row = rowText;
        this.expectedFact = expectedFact;
    }
}
