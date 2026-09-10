// pipeline/index.ts — THE ENGINE DOOR. A caller (the bench, a Node test, the engine package, a
// server) needs exactly these names: the two calls — the search and the record delivery — and the
// shapes of their requests and the one answer. Everything else in this folder is internal (T4).

export { solveGrid } from './solve'
export { deliverRecord } from './deliver-record'
export type { GridRequest, GridSolve, RecordRequest } from './types'
