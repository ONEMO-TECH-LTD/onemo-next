import type { ApplyProductLogicInput, ProductLogicDocumentJson } from "./types.js";
/**
 * Applies only caller-supplied product judgements and precedence to the complete
 * accepted candidate set. It performs no geometry and creates no candidates.
 */
export declare function applyProductLogic(input: ApplyProductLogicInput): ProductLogicDocumentJson;
