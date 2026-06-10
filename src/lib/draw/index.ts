// draw — public contract (freehand → snap-as-suggestion OR faithful keep-raw vectorisation).
// Blueprint: v3/blueprint/modules/draw.md (+ companions/shapes-generators-draw-explained.md).

export { recognizeStroke, normalizeStroke, resampleStroke, cloudDistance, CLOUD_N, type StrokeTemplate, type DrawMatch } from './recognizer'
export { libraryTemplates } from './templates'
export { vectoriseStroke } from './fit'
