# grid-engine v3.2

`canon/` is what governs — **two documents, named by Dan, and nothing else.**
`plans/plan-and-contract.md` is the live engine contract built from them.
`audit/` is the live evidence. `99-archive/` is provenance only — process documents,
superseded plans, QA reports and captured frames. Nothing in the archive may create
work or a gate, and neither may `FINAL-CONSOLIDATED-PROPOSAL.md`, which is superseded.

**Authority order** (logic-spec §5, verbatim): Dan's rulings → the ONEMO Compute System
doc *("latest, has more power")* → `grid-laws.md` → measured physics. The v3 law book in
`_WIP/grid-engine-v3/` ranks **third** and is superseded wherever it conflicts with the
Product Base — two lanes have already had to withdraw findings taken from it.

## canon — two documents, and only these two

Dan, 2026-08-17: *"these 2 are canon."* Nothing else in this folder is canon, however
useful. An execution plan is not canon; a donor spec is not canon; a transcript is not canon.

- **`ONEMO Magnetic Grid Compute System — Product Base and Logic Architecture.md`** —
  the Product Base. §§4-6 classification, §8 structure, §11 the selection order,
  §19 the result contract. This is what the selector implements.

- **`logic-spec-optimum.md`** — the design anchor. Every clause is marked **[RULED]**
  (Dan's words, source cited), **[DERIVED]** (a reading offered for veto) or **[OPEN]**
  (named, undecided). Read the marker before treating a clause as authority.

## Not canon — at this folder's root

- **`plans/plan-and-contract.md`** — **the live engine contract.** This is what governs
  the build. Owner s62-grid-qa.

- **`FINAL-CONSOLIDATED-PROPOSAL.md`** — **SUPERSEDED, 2026-08-17.** The prior v3.2
  execution plan, T0 through T9, owner s62-grid-meta-qa. It was executed and the result
  regressed the engine it was built to perfect; the three audits in `audit/` measured that
  from three separate worktrees. Superseded by `plans/plan-and-contract.md`. It may not
  create work or a gate. Kept as provenance, and still load-bearing for one thing: its
  "Governing boundary" section carries the **v3.3 donor rule** — a mechanism may cross from
  v3.3.1 only when a named task requires it, the v3.2 substrate lacks it, and it passes that
  task's own gate.

- **`R3-specs/`** — donor, not canon (Dan 2026-08-17). Neutral certification mechanics
  only. Cannot require, disable, or hold product work.

- **`audit/`** — the live evidence: three independent canon audits of the shipped engine,
  the lead audit of the contract, and the v3.3.1 donor audit.

- **`../ChatGPT-Grid and Band Logic-20260816-1022.md`** (at this folder's root, not inside
  `canon/`) — the founding GPT Pro conversation the Product Base was derived from. Dan
  named it a basis document alongside the three above. It sits at the root because all
  three lanes cite that path in their audit reports; moving it would break those citations.

## audit — the live evidence

Written 2026-08-17 after the v3.2 build was measured against the canon table. Three
independent audits from three lanes in three separate worktrees.

- `lead-audit-report.md` · `grok-qa-audit-report.md` · `meta-audit-report.md` — the three
  independent measurements. They converge: v3.2 regressed the engine it was built to
  perfect. Scored by **family** (Meta/grok), not magnet count (lead) — canon §6 says
  *"the FAMILY is the canon"*, so the count-based score reads too kindly.
- `three-module-definition.md`.

## plans — the working contract

- `plan-and-contract.md` — the working contract for the repair. This is the only durable plan.

## One open item that canon does not settle

The unsupported-extent limit. Its authority traced to the T0 ledger, now archived and
declared dead after two of its provenance rows were found to cite Dan turns that exist
only as lane restatements; logic-spec §8's open register lists the switch as undecided.

Dan ruled the **mechanism** on 2026-08-17: expose it as a calibrated slider, default 0,
and calibrate the engine against real shapes rather than ruling a number blind. That
follows his standing method — where a definition is unruled it becomes a switch to test
(captured turn, `claude/s62/meta/2026-08-11/_day.md:514`).

What the **default position** should be is still open, and it is the master switch rather
than a fine adjustment. Measured across all seven canon shapes: 0mm → 0 of 7 answer ·
6mm → 1 of 7 · 12mm → 2 of 7 · 24mm → 6 of 7.
