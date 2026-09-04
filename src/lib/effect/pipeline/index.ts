// pipeline/index.ts — THE ENGINE DOOR. A caller (the bench worker, a Node test, the engine package,
// a server) needs exactly these three names: the headless call and the shapes of its request and its
// answer. Everything else in this folder is internal (T4, 2026-09-03).

export { solveGrid } from './solve'
export type { GridRequest, GridSolve } from './types'
