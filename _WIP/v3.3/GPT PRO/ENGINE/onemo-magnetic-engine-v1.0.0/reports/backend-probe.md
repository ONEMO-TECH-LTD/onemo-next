# Backend engineering-gate result

## Contract

The approved specification requires a bounded comparison and exactly one shipped runtime. Correctness and reproducible build outrank speed.

## Candidate results

| Candidate | Reproducible in this environment | Correctness probe | Payload/compute probe | Verdict |
|---|---:|---|---|---|
| Dependency-free fixed-point TypeScript | Yes | Passed exact tangency, one-quantum intrusion, concavity, canonical determinism and final exact disc proof | Measured; see benchmark and bundle reports | **Selected** |
| C++/Clipper2 → WebAssembly | No | Not run | Not run | Disqualified: `emcc`/Emscripten unavailable, so no reproducible build artifact could be produced |

## Selected runtime

`geometry-compute-ts-fixed-v1`

Properties:

- one ESM runtime in browser/Node;
- no runtime dependency;
- integer canonical coordinates;
- `BigInt` exact orientation and distance comparison for final legality;
- adaptive continuous-domain evidence;
- generated executable artifact digest;
- no dual fallback lane.

## Limits of the result

This is a valid gate result for the execution environment: the unavailable WASM candidate was not assigned hypothetical measurements. The TypeScript runtime meets the correctness, package-size and 16 ms warm certified all-band gates on the recorded machine. Cold and high-vertex measurements remain explicit; no physical-mobile result is claimed.
