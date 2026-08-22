# v3.5.2 T3 post-Wrap commit audit — reconciled Grid-Meta + Grid-QA

Authority: v3.5.2 master/T3, preserving the operative content approved at `a65added`; [`T3-execution-matrix.md`](./T3-execution-matrix.md) SHA-256 `f3bde325b18f1c2957d2b211b3bdc25222a7309d0aa71cc6b197f329b11a06f7`. Audited product range: `2c043257..1ccba648`, 34 commits. Both reviewers read every commit patch, resulting runtime files and changed tests independently.

`KEEP` means retain as a necessary recovery input, not delivered-product credit. `REWORK` means recover only the named correct portion in its first live consumer. `REVERT` means remove by history-preserving forward commit.

| Commit | Verdict | Joint disposition |
|---|---|---|
| `68b77a82` exact scaling roots | REWORK | Retain rational/quadratic root isolation and its non-integer oracle only when the live event path consumes it; exclude the throwing `solveBands` stub, duplicate result schema and allowlist entry. |
| `48080951` remove premature scaling surface | KEEP | Necessary subtraction: prevents the throwing stub/unused public API from returning. |
| `2eab9fa2` transform exact scaling values | KEEP | Retain exact affine transform/comparison for rational/algebraic sites; not delivered until consumed by scaling/Wrap. |
| `14013a34` canonicalize exact roots | KEEP | Retain normalized polynomial/root-index equality across isolator refinement. |
| `7a1f814c` unbounded exact comparison | KEEP | Retain uncapped refinement; no precision cap may decide law. |
| `c1132856` exact contact events | REWORK | Retain rational segment equations/lattice enumeration; add exact projection-class membership, frozen-Centre inputs, exact-scale boundary/anchor witnesses and live `solveBands` consumption. |
| `91ad1588` exact Box/Weight coefficients | REWORK | Retain full-outer Box. Weight must reproduce frozen `centroidOf(outer)` and ignore holes; current hole subtraction is forbidden before Centre repair. |
| `06a5f96b` parity events | KEEP | Retain exact current bbox/parity thresholds as recovery input. |
| `9aca7e75` continuous band domains | KEEP | Retain exact half-open `[floor,nextFloor)` ownership and 71.5/72 boundary proof. |
| `24a3a1ad` B1-B4 horizon | KEEP | Fully live and required; prevents B5 returning to engine/worker/UI. |
| `3849ed1f` certified scale expression | REWORK | Reuse only if the live exact-scale Wrap adapter requires this expression form; initial float-seeded bounds cannot remain. |
| `c1911cdf` exact expression bounds | REWORK | Retain only with the live adapter; supplies directed rational bounds replacing the float seed. |
| `a98bb671` replay validation | REWORK | Retain only if that exact expression crosses worker/cache; validate every re-entry. |
| `862b71e4` offset primitives | REVERT | Unauthorized/dormant continuous Centre repair. |
| `d78e9078` offset intersection inventory | REVERT | Test-only/dormant Support-B path. |
| `2d4ff6fa` ruled offset correction | REVERT | Correction to the same unauthorized path does not authorize it. |
| `94ed1811` offset line intersections | REVERT | Dormant continuous-offset machinery. |
| `5e2c4417` offset-expression comparison | REVERT | Dormant general offset expression layer, broader than the possible Wrap expression subset. |
| `d7075132` offset curve intersections | REVERT | Dormant continuous-offset machinery. |
| `4f1c81b6` arrangement faces | REVERT | Dormant Support-B topology. |
| `d3cad630` legal offset edges | REVERT | Dormant/test-only midpoint legality path. |
| `fac33358` canonical offset rings | REVERT | Identity hardening for unauthorized continuous Centre repair. |
| `e77bfcdf` generic predicate roots/multiplicity | REVERT | Generic proof surface has no live consumer; derive only the narrow contact multiplicity required by a live fixture. |
| `5c4a5c70` predicate-root ordering | REVERT | Fix to dormant generic predicate stack. |
| `c1ae5da7` algebraic elimination order | REVERT | Dormant generator/elimination identity. |
| `977de4ef` square-free generator proofs | REVERT | Hardening of dormant generator platform. |
| `14819271` elimination coefficients | REVERT | Dormant multivariate provenance. |
| `6a6f0022` multivariate proof tokens | REVERT | Post-approved invention with no worker/engine consumer. |
| `2f67321c` sparse pseudo-remainders | REVERT | Dormant resultant engine. |
| `3d335fbb` zero-resultant components | REVERT | Dormant common-component machinery. |
| `c772168b` represented algebraic roots | REVERT | General factorization/generator certification exceeds retained rational/quadratic rung needs. |
| `5c9a6f40` algebraic tuple back-substitution | REVERT | Dormant 879-line primitive-element/RUR platform. |
| `40d90c53` exact contact-root typing | REWORK | Retain only runtime `exact-real.ts`/`regimes.ts` narrowing and tuple repairs; discard offset-test coupling. |
| `1ccba648` predicate proof requests | REVERT | Identity/spec/test-only request platform with no producer/evaluator/engine/worker/UI consumer. |

## Joint verdict

Necessity — shrink the dormant continuous-offset, arrangement, resultant, multivariate-token, generator, RUR/tuple and predicate-request platform. Retain no foundation without its first live consumer.

Sufficiency — recovery disposition is complete; product remains partial. Still required: one approved frozen-Centre site mechanism, exact-scale Wrap adapter, complete candidate/reducer/result contracts, live `solveBands` and typed fixed inspection, worker all-band cache/stored lookup, and truthful exact-rung UI.

No product edits, tests, commits or builds were performed. Product HEAD remained `1ccba648fd66143154d29b4cf6602ff166b467d2`; untracked `safe-topology.test.ts` and `scaling.test.ts` were preserved.
