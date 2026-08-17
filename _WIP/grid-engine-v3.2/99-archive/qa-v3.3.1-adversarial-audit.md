# GPT Pro grid engine v3.3.1 — adversarial audit

**Verdict: FAIL. Do not integrate this delivery.**

The folder labelled `v3.3.1-repaired` does not contain the repaired engine described in GPT Pro's final response. Its three package archives are byte-for-byte the original v1.0.0 archives that the supplied repair audit failed. Zero package bytes changed, and every blocking counterexample rerun against the alleged repair still fails.

This is an artifact-delivery failure before it is a new engineering review. The correct next action is to recover the actual master archive whose checksum GPT supplied. If that archive cannot be produced, GPT Pro must redeliver the completed repair; the team should not repair or integrate these stale archives.

## Artifact identity

The current folder contains:

| Package | Current SHA-256 | Original v1.0.0 SHA-256 | Byte comparison |
|---|---|---|---|
| Geometry Compute | `a94e65709fc42d13851525ffe5f442ec9a9ec134b0b540b4ec1cdc5cd474ea24` | same | identical |
| Magnetic Logic | `8c18ab741b71d67db2e6bbcf0995d0627b8ff3804fefadb12c55014065b45f8e` | same | identical |
| Magnetic Next | `6bc884a673b655fdc08856101dfbe65a15e2f7de87f34aab98dbc59af6273663` | same | identical |

The packages still declare version `1.0.0`. The current directory omits the old root source workspace, scripts, package manifest and TypeScript base configuration. It adds only incomplete/stale release wrappers.

GPT Pro supplied an expected master-archive checksum:

`0c2d2f43db72686fe61c8b8c752d61553cf8237727e164b91b17b7dceef03382`

No master archive is present to verify against it. The checksum file points to `/mnt/data/onemo-magnetic-engine-v3.3.1-repaired.zip`. The release-evidence markdown ends immediately after opening a JSON fence.

## Claim-versus-delivery result

GPT Pro claimed all eight repair groups, new regressions, clean install/build, certified all-band preview, tamper rejection, ≤16 ms performance, browser/Node identity and real Effects Studio integration had passed. The supplied artifact contains none of the claimed new reports or gates:

- no defect map;
- no raw pre-repair or post-repair regression output;
- no final-gate JSON;
- no performance-results report for a certified preview;
- no tamper-probe output;
- no browser/Node determinism report;
- no Effects Studio runtime evidence or screenshot;
- no engineering-versus-unresolved-input report;
- no package checksum set for repaired packages;
- no repaired master ZIP.

The included `manual-clean-install-build-test.txt` and `verify-release-rerun.txt` instead record `ENOENT` because `/mnt/data/onemo-magnetic-engine/package.json` did not exist.

## Independent execution

### Shipped tests

- Geometry Compute: **11/11 pass**.
- Magnetic Logic as delivered: **cannot start** because `@onemo/geometry-compute` is absent.
- Magnetic Logic after locally linking the supplied Compute package in an isolated temporary extraction: **11/11 pass**.
- Magnetic Next: **3/3 pass**.

These are the same 25 old tests cited by the pre-repair audit. They do not contain the required repair regressions.

### Build

All three independent package builds fail because `tsc` is undeclared/unavailable. Each package also extends a missing `../../tsconfig.base.json`. The supplied top-level folder has no usable root `package.json`; its lockfile contains no workspace.

### Performance and certified coverage

The fast path remains the incomplete critical-point preview. The separate continuous certification path produced:

| Square target | Result | Independent time |
|---:|---|---:|
| 24 mm | accepted, `single` | 7.78 ms |
| 72 mm | indeterminate at M03 | 137.67 ms |
| 120 mm | indeterminate at M03 | 2551.77 ms |
| 168 mm | indeterminate at M03 | 1854.08 ms |
| 216 mm | indeterminate at M03 | 1152.27 ms |

Therefore the delivered engine cannot produce authoritative certified offers across the bands and does not meet the 16 ms requirement.

## Repair audit rerun

The attached `03-engine-audit-and-fix-list.md` was recovered from the original repair pack and its SHA-256 matches GPT Pro's recorded authority hash: `1e5ba8fbffdd0e0edcfe93ebe36f265cfe77bc9ebae1bd3ad65585f7e0dafd7e`.

Every blocking group remains open.

### 1. Safety and profile authority still fail closedness

- A requested radius of `12.004` mm in a 24 × 24 mm square is still returned `legal:true`, `exactAtQuantum:true`, with margin `-0.004` mm. The safety radius nearest-rounds down instead of aligning or rounding upward.
- Retaining a registered profile's hash while changing `cellMm` from 24 to 20 still causes two different outputs to claim the same profile identity.
- `sizeDomain.stepMm = 0` still registers successfully.
- Deleting a profile's old hash, marking it production-ready, replacing the protected radius with `0.01` mm and supplying an arbitrary pattern still registers as `approved` and `productionReady:true`.

### 2. Certified optimisation is still incorrect/incomplete

- Compound min/min fixture `A=([0,0],[100,100])`, `B=([0.5,1.5],[0,0])`, `tau=(1,1)` still constructs anchor `([0,0],[0,0])`, prunes A and retains B. Component 2 is still deciding while component 1 is uncertain.
- The public final tie-break still samples only canonical clamp, centre and corners. A legal representable point inside an optimum box can exist while it returns `FEASIBLE_BELOW_OUTPUT_QUANTUM` after five attempts.
- `solveOutline` still labels finite heuristic critical witnesses `EXACT` and emits `OFFERED` results without completeness proof.
- `certifyAndBindSelectedBand` certifies only the preview-selected rung. It does not certify every smaller rung rejected, so it cannot prove `SMALLEST_ACCEPTED_PER_BAND` even when the selected target itself certifies.

### 3. Structural and policy evidence is still unsound/incomplete

- A 24 × 24 mm square at radius 12 still yields zero sampled cells/components despite its exactly legal centre.
- A 34 × 34 mm square still labels region coverage at `(6,0)` as `EXACT` even though the radius-12 disc is exactly illegal there.
- Population `originParities` and `strideCells` remain unused in hypothesis construction. A supplied 96 mm population cannot be correctly enumerated or enforced.
- `marginalNodesAllowed` remains unused, and the profile cannot express the full governed permission dimensions.
- M02 still selects upper regions by `bounds.maxY`, not projection on the registered top direction.
- Canonical ordering still uses locale-dependent `localeCompare`.
- The decision trace still omits the specified M09 discrete-identity and M10 final-registration steps.

### 4. Manufacturing evidence remains forgeable and unbound

A production-marked B1 spec was modified to contain:

- a nonexistent pattern, population and frame;
- registration `(999,999)`;
- cell address `(999,999)`;
- zero base radius;
- a forged tolerance rule;
- approximation tolerance `999`.

After recomputing the public canonical hash, `verifyEngineManufacturingSpec` returned `valid:true`.

The source/certification binding also remains absent. A preview from a 120 × 60 rectangle was combined with certification of a 24 × 24 square. The spec recorded the rectangle source hash and square final geometry, then verified successfully.

Historical artifact/profile resolution remains unimplemented; static compiled constants stand in for resolving the pinned executable artifacts.

### 5. Next integration and delivery remain illustrative

- The overlay still draws only a bounding rectangle and never renders `finalRingInt`.
- The example is excluded from compilation.
- The permissive local React shim remains.
- Tests still do not exercise the hook, loader, overlay, certification adapter, server verifier or example.
- The v3.3.1 delivery contains no runnable Effects Studio route or application workspace. There is no current surface whose claimed integration can be visually verified.
- Physical component dimensions and complete tolerance fields remain insufficiently validated.

## v3.2 versus this v3.3.1 delivery

Neither engine conforms, and neither should be declared the production engine.

| Capability | v3.2 | supplied v3.3.1 |
|---|---|---|
| Real Effects Studio/bench integration | present | absent |
| Canon contours and product-facing templates | broader but partly re-pinned/heuristic | minimal reference patterns; Batwoman source absent |
| Exact geometry legality | useful existing substrate | stronger neutral quantised/BigInt substrate, but radius rounding is unsafe |
| Placement search | large heuristic sweep, not certified | fast heuristic preview plus separate attempted certification |
| Authoritative all-band results | no | no; B2–B5 square certification is indeterminate |
| Governing mechanics | incomplete/inferred | architecture closer to R3, but structural evidence and several policies are unsound or missing |
| Manufacturing identity/verification | incomplete | schema exists, but semantic tampering passes |
| Performance | tens of seconds on canon shapes | preview around 50 ms in bundled report; certified path up to seconds |
| Reproducible delivery | normal project worktree exists | supplied repaired folder cannot clean-build or run as a root release |

The useful boundary remains:

- preserve v3.2's actual app bridge/UI, source contours and independently valid neutral measures;
- preserve v3.3.1's Compute → Logic → Next architecture and useful exact geometry implementation only as repairable source;
- do not install this stale v3.3.1 selector or verifier into the v3.2 worktree;
- do not continue tuning v3.2's heuristic selector as the route to certification.

## Required recovery

1. Re-download the **single master archive** from GPT Pro's final response.
2. Verify its SHA-256 is exactly `0c2d2f43db72686fe61c8b8c752d61553cf8237727e164b91b17b7dceef03382` before extracting it.
3. Confirm it contains the claimed repaired package names, root manifest/scripts, defect map, regression outputs, final-gate JSON, tamper results and runtime evidence.
4. If the master archive is unavailable, mismatches that hash, or contains the same three v1.0.0 package hashes above, send GPT Pro a delivery-discrepancy demand. Do not reopen architecture or rewrite the fix list: require the already-claimed repaired artifact and evidence.
5. Only then rerun this audit and compare the genuine repaired engine with v3.2 on the real Effects Studio surface.

## Necessity and sufficiency

**Necessity — no unnecessary work:** no assembly, donor extraction, fresh engine design, v3.2 selector tuning or local repair of these stale ZIPs is justified. Recovering the artifact GPT Pro already claimed is the smallest next action.

**Sufficiency — not delivered:** the supplied folder does not contain the repaired implementation, does not close any of the eight repair groups, cannot build as delivered, cannot provide certified all-band offers, and cannot exercise the real integration.

**Disposition: reject this artifact; recover or demand the genuine repaired master archive.**
