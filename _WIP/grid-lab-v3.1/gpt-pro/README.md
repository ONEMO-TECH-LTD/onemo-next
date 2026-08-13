# GPT Pro — engine build, part by part

One forked GPT Pro chat builds the engine in three parts. The fork was branched at
GPT's FIRST response to the original brief, so none of the later biased history
(one-size-per-band, layout catalogues, single-winner selection) exists in that lane.

Each part folder holds:

- `prompt/` — the exact message pasted into the chat, verbatim.
- `delivery/` — what came back, unpacked, plus its contract.

| Part | What it does | Status |
|---|---|---|
| 1 — geometry kernel | measures: which lattice positions hold a full disc at a given size, exact clearance, limiting witness, straight-corridor fact. Decides nothing. | DELIVERED, verified: manifest hashes OK, 18/18 golden tests pass, no product policy present, no floating point in any predicate path |
| 2 — candidate enumerator | turns kernel facts into every lawful arrangement using Dan's canon grammar. Scores nothing, ranks nothing, prunes nothing. | prompt written, not yet sent |
| 3 — product logic | gravity, region coverage, tight wrap, escalation, ranking — over the immutable candidate set. | not started |

Rules that hold across all parts:

- The kernel is neutral: no bands, arrangements, ranking or preference inside it.
- The arrangement grammar comes from `_WIP/grid-engine-v3/grid-laws.md` (L20) and
  `selection-examples/` — never invented by GPT.
- Selection examples are acceptance oracles only: enumerator completeness and product
  ranking. They never reach kernel design.
- Every part is delivered as a self-contained downloadable package, verified here
  before the next part is requested.
