# E8 conformance report — HEAD 649711d

- Conformance matrix: **241/241**
- Behavior gates: **27/27**
- Overall: **GREEN**

## Dan's 12 items → gate coverage
| Item | Gates | All pass |
|---|---|---|
| 1/5 font + anatomy of every input | 196 | ✅ |
| 2 variable pill → picker preselected | 8 | ✅ |
| 3 raw value badge only | 2 | ✅ |
| 4 picker figma names + scoping + search | 3 | ✅ |
| 6 field min-width + responsive | 2 | ✅ |
| 7 panel min/max resize | 4 | ✅ |
| 8 Link To last | 3 | ✅ |
| 9 scroll + hover/tap | 3 | ✅ |
| 10 rotation undo + degree | 4 | ✅ |
| 11 type-no-Enter reverts on blur | 3 | ✅ |
| 12 drag scrub | 3 | ✅ |

## Contract provenance
Measured live from Dan's authenticated Figma tab (ONEMO DS v2.3.1) 2026-07-07 via programmatic DOM census + real-input behavior probes. Entries with measured:false are PENDING extraction and MUST fail the audit until filled — never skipped (expert harness law: contract from spec, fail loud).

> Run `node editor-engine/audit/audit-export.mjs` to regenerate. Both source tools are two-run deterministic.