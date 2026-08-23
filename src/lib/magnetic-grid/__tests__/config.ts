// Fixture helper: a complete validated SolverConfig from the shipped defaults plus the fields a
// case actually varies. Tests state their own calibration explicitly — this is NOT downstream
// defaulting: it goes through Spec's own validator, exactly like the worker's ingress.

import { SOLVER_DEFAULTS, validateSolverConfig, type SolverConfig } from '../spec'

export const configWith = (overrides: Partial<SolverConfig> = {}): SolverConfig =>
  validateSolverConfig({ ...SOLVER_DEFAULTS, ...overrides })
