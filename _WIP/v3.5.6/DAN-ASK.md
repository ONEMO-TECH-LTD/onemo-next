# Dan's Step 1 and Step 2 checklist

Authority: `_WIP/v3.5.6/DIRECTIVES-VERBATIM.md`, corrected against the full s62/lead day-files
for 2026-08-30 and 2026-08-31. The QA scope is this checklist plus that source sheet, never the
builder's diff. A row is not complete while any required behavior or live proof is missing.

## Step 1 — classifier, canon and sweep

| Directive | Current state before full-scope QA |
|---|---|
| Post-load table: every band midpoint, outer/legal boxes, governed centre; classifier knows no count | **NARROWED** — rows exist, but source shows they are recomputed inside each band solve rather than once post-load |
| Lookup digests the selected ruler box and returns the best square/rectangle canon, orientation locked in the record | Built; full-scope QA owed |
| Canon is a suggested starting population inside the existing 1mm free search, using the same four registrations, seating, wrap and band rule | Built; full-scope QA owed |
| Canon fit keeps its rows/columns and maximises supported positions; free-search `min` and `max` remain separate comparables | Built; full-scope QA owed |
| Coincident optimal/min/max results collapse to one row; product labels are `optimal`, `min`, `max` | Built; full-scope QA owed |
| Wrap remains mandatory and byte-untouched | Built; full-scope QA owed |
| Outer/legal classifier ruler toggle; default legal | Built and previously live-gated; full-scope QA owed |
| Canon may step down, never up, when the requested band has no fitting canon | Built; direct Dan quote has a source gap in the required vault files |
| Butterfly worked example: 2×2 or 3-point triangle/diamond | **NARROWED if the supplied quote is confirmed** — 2×2 step-down exists; automatic 3-point preset path does not |
| Library UI: band filter; portrait/landscape record filter; locked canon orientation; canon legal-area dimensions | Built; full-scope QA owed |

## Step 2 — unprotected area and holding filters

| Directive | Current state before full-scope QA |
|---|---|
| Clipper2 legal-area subtraction with 24–48mm protection reach | Built; full-scope QA owed |
| Toggle 1 — perimeter over centre | Built |
| Toggle 2 — hold extremes, hard enforcer before roles | Built |
| Toggle 3 — span ends, not geometric vertices | Built |
| Toggle 4 — top gap, with top as drawn | Built |
| Enabled preferences apply evenly | Built as equal rank-sum |
| Toggle 5 — universal span-end/unprotected-area law; original four retained for comparison | Built |
| Toggle 6 — balance/centring enforcer; one lopsided flap loses to two smaller balanced gaps | Built |
| All six controls independently switchable | Built |
| UI is a separate left-side card matching Centering; short labels; grey off / blue on | Built at `c211c571`; independent full-scope live gate owed |

## Source gaps requiring explicit treatment

The corrected directive sheet preserves supplied direct-text claims that do not occur in the two
required day-files: Step 1 max-count clarification, lower-band wording, Butterfly worked example;
Step 2 extra Clipper wording, later all-toggles wording, and short-label colour wording. They cannot
be represented as independently verified vault quotes. Recover their source or obtain Dan's direct
confirmation before using them to close a disputed requirement.
