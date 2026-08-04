# Grid Lab v2 — Bench + Engine self-audit vs LAW BOOK + BRIEFS (clause by clause)

> Triggered by Dan's 4-screenshot review + meta gate-fail on P6 (2026-08-04). No claim without an
> observation. Status: **FAIL — reworking.** Each clause: ✅ pass (evidence) · ❌ fail (fix) · ⚠ gap.

## LAW — Part I

| Clause | Requirement | Status | Evidence / Fix |
|---|---|---|---|
| §1.1 | 48mm base pitch, 96 coarse | ✅ | config.lattice, both selectable |
| §1.2 | straight default; diagonal/dice admin options | ❌ | **no pattern control on bench**; engine population is straight-only |
| §2.2 | padding 10mm, released input | ✅ | config + bench editor |
| §2.3 | frameless; frame additive | ✅ | sizeOf frameless, applyFrame; bench frame=0 |
| §3.1–3.4 | population→link→offset→even-mm | ✅ | shape.ts; anchors 68/88 verified |
| §3.5 | worked anchors square 68 / circle 88 | ✅ | tests + bench |
| §4.1 | **Light = boundary ring (perimeter only); interior drops** | ❌❌ | **boundaryRing is lattice-adjacency → keeps interior band on diamond/triangle/freeform. CORE VIOLATION. Fix: geometric perimeter mask** |
| §4.3 | Light is product default; Standard admin | ⚠ | Light default ✅ but density default wrong (see §6.2) |
| §4.3a | dice = 96 + cell centres, legal only at 96; diamond = 48√2 | ⚠ | engine has the basis (P1) but P3 population ignores pattern; bench can't select it |
| §5.1 | source-blind neutrality | ✅ | no source param |
| §5.3 | every basic family, no privileged shape | ⚠ | families present; ngon not exposed (v1 scope ok); rounded ✅ |
| §5.7 | focal-8 at radial extremes | ✅ | magnetPlan hull; bench red/black |
| §6.1a/6.2 | garment: 48-straight/96-straight/96-dice; **canon = 96 dice** | ❌ | **bench default is 48 straight, not 96 dice** |
| §6.3 | denser nests on sparser | ⚠ | not surfaced |
| §7.7 | controls may not overlap in meaning | ⚠ | check |
| §7.8 | no lying control (changes picture not product) | ❌ | **cornerRadius persists across families; "· offset" debug caption** |
| §8.x | publication rules released | ✅ | snapUp/tiers/ONE/labels |
| §9.1/9.2 | sub-second, no silent spinner | ✅ | instant, errors surface |
| §10.1–10.6 | headless portable, sealed API, swappable, no monoblock, all values via config | ✅ | index.ts seal; clipper only in offset.ts |

## LAW — Part II (attachment / garment)

| Clause | Requirement | Status | Fix |
|---|---|---|---|
| §5.1a | attachment↔grid compatibility (magnetic=48-straight\|96-dice, twin-fix free) | ❌ | in config, but **no attachment control / filter on bench** |
| §5.2 | magnetic / twin-fix / velcro | ❌ | not selectable on bench |

## BRIEFS

| Brief | Requirement | Status | Fix |
|---|---|---|---|
| 62.1 | **v5.3.1 blend + image/shape outline MUST BE INTEGRATED** | ❌❌ | **AI Magic absent — preset star ≠ integration. Wire v5.3.1 image→cutout→outline→engine** |
| 62.1 | shape generator incl. rounded sides/corners (pill/stadium) | ✅ | pill + rounded |
| 62.4 | backend-portable; UI control surface only | ✅ | engine headless; bench calls sealed API |
| 62.6 | every input changeable + saved, reach every focal value | ❌ | **pattern, attachment, registration, tessellation not reachable on bench** |
| 62.8 | whole package: engine + admin UI (every input saved) + clipper + freeform + mm spec + sub-second | ❌ | partial — controls + AI Magic missing |

## FIX ORDER
1. **Engine: Light = geometric perimeter** (P1/P3) — the core law violation.
2. **Engine: pattern-aware population** (straight/diamond/dice inside a shape) — enables §4.3a/§6.2.
3. **Bench defaults**: Light·96·dice (garment canon); clean captions; scope cornerRadius per family.
4. **Bench controls**: pattern selector, attachment selector + 5.1a filter readout, registration, every config value reachable + saved.
5. **AI Magic**: integrate v5.3.1 image→outline → engine freeform.
6. **Per-behaviour visual verification** with evidence per item (every mode×density, dice@96, per-family ladder vs catalogue, attachment filter, image→outline→engine).
