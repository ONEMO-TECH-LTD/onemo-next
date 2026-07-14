# s58-qa Deepening v2 re-gate — component engine blueprint

Verdict: PASS for the I2/deepening v2 multi-axis contract, with REQUIRED non-I2-blocking §3.5 doc fix.

Build authority reviewed: `/Users/daniilsolopov/Dev/onemo-dev/__qa-dispatch/s58-component-engine-BLUEPRINT.md`
Current file fully read lines 1-467. Source model read lines 1-108.

## F1-F6 rework check

PASS — F1 folded into base:
- `ComponentModel` primary shape is `variantAxes[]` + `states[]` at blueprint lines 23-40.
- Single-axis is explicitly N=1, not legacy, at lines 45-48 and 266-270.
- `write-scoped-declaration` uses composite `scope` at lines 117-136.
- Deepening section says D1/D2 are folded and no competing shape at lines 363-368.

PASS — F2 className compile:
- Default-composes via `styles[`${ax.axis}_${props[ax.axis] ?? ax.defaultValue}`]` at lines 266-273 and 383-390.
- Gates for defaulted axis and two-axis composition at lines 312-315.

PASS — F3 deterministic selector:
- Selector order: base, axis classes by `variantAxes` index, semantic `[data-*]` by 6-state order, pseudo last at lines 125-132.
- Combinatorial gate at lines 316-319.
- D2 restates read/write decomposition at lines 405-412.

PASS — F4 side-channel decisions:
- Connector comment is mandatory source of truth and persists on export at lines 172-188 and 431-434.
- Transition side-channel persists on export and is source-of-truth at lines 424-430.
- I4 gate reads side-channel, not JSX inference, at lines 349-354.

PASS — F5 structure payload/refusal:
- `set-variant-structure` add/remove/swap payloads fully specified at lines 192-211.
- Deep reparent is explicit 422 boundary, not loose later/v1 language, at lines 205-210 and 440-450.

PASS — F6 CVA citation:
- Blueprint cites `class-variance-authority@0.7.1` and exact file/lines at lines 370-376.
- Verified local package `/Users/daniilsolopov/Dev/onemo-dev/onemo-next-editor/node_modules/class-variance-authority/dist/index.d.ts` version `0.7.1`; lines 22-35 contain `variants`, `defaultVariants`, `compoundVariants`, and `cva(...)`.

## Required doc fix (non-I2-blocking after lead clarification)

MED — semantic `add-state` timing contradicts the accepted I1 closure/code contract.

Blueprint lines 166-171 say semantic `add-state` creates the `.base[data-<state>]` rule and adds the boolean prop in the same op:
- `SEMANTIC (loading/error) → creates the .base[data-<state>] rule AND adds the boolean <state> prop...`

But the just-accepted I1 closure at `d671909` proved and accepted this behavior instead:
- `add-state loading` adds the boolean prop + `data-loading` toggle.
- ComponentModel lists `loading` immediately from prop presence.
- There is no `.base[data-loading]` rule before the first scoped semantic edit.
- Repeat add-state returns 200 no-op/re-targeted.

The blueprint already has the correct READ rule at lines 50-55 and the correct rationale at lines 746-753 in implementation, but lines 166-171 and gate wording lines 336-338 still encode the older "add-state creates semantic CSS rule immediately" contract.

Required doc fix before the next full blueprint status/Dan packet:
- Lines 166-171 should say semantic `add-state` ensures the semantic state exists by adding the boolean prop + root `data-<state>` toggle; the state is model-visible immediately even if unstyled; the first scoped declaration writes `.base[data-<state>]`.
- Lines 336-338 should split the gate similarly: pick Loading -> prop/data toggle + immediate ComponentModel state; edit a field in Loading -> `.base[data-loading]` rule; toggling prop shows the styled state after that scoped edit.

Why this does not block I2 after lead clarification:
- The stale line is I1/states scope.
- The accepted and gated I1 behavior is already the shipped code at `d671909`.
- F1-F6/I2 multi-axis contract is orthogonal: `variantAxes`, `mint-union-prop`, composite `scopedSelector`, deterministic selector order, connector side-channels, and structural payloads are all coherent.
- It still must be fixed in the blueprint because the document is build authority and should not preserve a stale WRITE-op sentence.

## Non-blocking notes

- `s58-framer-CODE-model.md` still contains old source-note planning words (`v1`, `deferred`, `later`) at lines 22, 57, 106, but I did not treat that as a blocker because the build authority supersedes it and the current blueprint lines 251-263 define the IN/OUT control set.
- Blueprint line 298 says legacy multi-export migration happens later; I did not treat it as a blocker because it is explicitly labeled pre-engine cleanup, not parity deferral.

## Self-audit

- Read coverage: blueprint lines 1-467, source model lines 1-108.
- Targeted searches covered competing shape/stale terms: `variantAxes`, `variants`, `single-axis`, `scopedSelector`, `@fc-connector`, `@fc-transition`, `set-variant-structure`, `deep reparent`, `v1`, `defer`, `later`, `FusedNumber`, `CVA`.
- No product source edited.
