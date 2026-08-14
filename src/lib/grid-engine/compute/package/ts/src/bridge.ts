import { canonicalJson } from "./canonicalJson.js";
import type {
  ArrangementPatternSpec,
  CandidateResult,
  DecimalPoint,
  EngineOkResult,
  EngineResult,
  GuardedPhysicalSpec,
  LatticeResult,
  SizeResult,
  SolveRequest,
} from "./contracts.js";
import { GUARDED_PHYSICAL_SPEC } from "./guardedPhysicalSpec.js";
import { INITIAL_GRAMMAR_V1 } from "./initialGrammar.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export interface EngineTransport {
  solve(requestUtf8: Uint8Array): Promise<Uint8Array>;
}

export interface RenderSelection {
  readonly candidate: CandidateResult;
  readonly lattice: LatticeResult;
  readonly size: SizeResult;
  readonly basePitchMm: string;
  readonly field: EngineOkResult["physical_spec"]["field"];
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value as Record<string, unknown>)) {
      deepFreeze(member);
    }
  }
  return value;
}

function parseEngineResult(bytes: Uint8Array): Readonly<EngineOkResult> {
  const parsed = JSON.parse(decoder.decode(bytes)) as EngineResult;
  if (parsed.schema !== "onemo.magnetic.solve.result/1") {
    throw new Error("engine returned an unsupported result schema");
  }
  if (parsed.status === "error") {
    throw new Error(`${parsed.error.code}: ${parsed.error.message}`);
  }
  if (!Array.isArray(parsed.candidates) || parsed.metrics.candidates_emitted !== parsed.candidates.length) {
    throw new Error("engine result candidate count is inconsistent");
  }
  return deepFreeze(parsed) as Readonly<EngineOkResult>;
}

export class SolvedCandidateSet {
  constructor(readonly result: Readonly<EngineOkResult>) {}

  get candidateCount(): number {
    return this.result.candidates.length;
  }

  candidateAt(index: number): CandidateResult {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.result.candidates.length) {
      throw new RangeError(`candidate index out of range: ${index}`);
    }
    return this.result.candidates[index]!;
  }

  renderSelectionAt(index: number): RenderSelection {
    const candidate = this.candidateAt(index);
    const lattice = this.result.lattices.find(
      (entry) => entry.registration_id === candidate.registration_id,
    );
    const size = this.result.sizes.find((entry) => entry.id === candidate.size_id);
    if (lattice === undefined || size === undefined) {
      throw new Error(`candidate references missing render data: ${candidate.id}`);
    }
    return Object.freeze({
      candidate,
      lattice,
      size,
      basePitchMm: this.result.physical_spec.base_pitch_mm,
      field: this.result.physical_spec.field,
    });
  }
}

export class MagneticEngineBridge {
  readonly #transport: EngineTransport;
  readonly #physicalSpec: GuardedPhysicalSpec;
  readonly #patterns: readonly ArrangementPatternSpec[];
  readonly #cache = new Map<string, Readonly<EngineOkResult>>();
  readonly #maxCacheEntries: number;

  constructor(options: {
    readonly transport: EngineTransport;
    readonly physicalSpec?: GuardedPhysicalSpec;
    readonly patterns?: readonly ArrangementPatternSpec[];
    readonly maxCacheEntries?: number;
  }) {
    this.#transport = options.transport;
    this.#physicalSpec = options.physicalSpec ?? GUARDED_PHYSICAL_SPEC;
    this.#patterns = options.patterns ?? INITIAL_GRAMMAR_V1;
    this.#maxCacheEntries = options.maxCacheEntries ?? 2;
    if (!Number.isSafeInteger(this.#maxCacheEntries) || this.#maxCacheEntries < 1) {
      throw new RangeError("maxCacheEntries must be a positive safe integer");
    }
  }

  buildRequest(outline: readonly DecimalPoint[]): SolveRequest {
    return Object.freeze({
      schema: "onemo.magnetic.solve.request/1",
      outline,
      scale_basis: "max_bbox_extent",
      magnet_radius_mm: this.#physicalSpec.magnet_radius_mm,
      base_pitch_mm: this.#physicalSpec.base_pitch_mm,
      field: this.#physicalSpec.field,
      sizes: this.#physicalSpec.sizes,
      registrations: this.#physicalSpec.registrations,
      populations: this.#physicalSpec.populations,
      patterns: this.#patterns,
    });
  }

  async solve(outline: readonly DecimalPoint[]): Promise<SolvedCandidateSet> {
    const request = this.buildRequest(outline);
    const requestText = canonicalJson(request);
    const cached = this.#cache.get(requestText);
    if (cached !== undefined) {
      this.#cache.delete(requestText);
      this.#cache.set(requestText, cached);
      return new SolvedCandidateSet(cached);
    }

    const result = parseEngineResult(await this.#transport.solve(encoder.encode(requestText)));
    this.#cache.set(requestText, result);
    while (this.#cache.size > this.#maxCacheEntries) {
      const oldest = this.#cache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.#cache.delete(oldest);
    }
    return new SolvedCandidateSet(result);
  }

  clearSolveCache(): void {
    this.#cache.clear();
  }
}
