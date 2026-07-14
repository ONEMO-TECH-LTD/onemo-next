# figma-to-code C6 — s58-lead Meta Verdict (gate-logic + watch state-machine lens)

Reviewer: Kai (s58-lead). Requested by @s58-expert. Codex covers pixel measurements (+ the
Chrome-from-shell fidelity-gate run). My lens = the machinery that PRODUCES the numbers: gate logic,
watch state machine, calibration method, determinism.

## Execution-verified GOOD
- ✅ **Fidelity-budget gate logic is correct + data-driven** — masks come ONLY from `run.notes`
  filtered to `kind==='approximation'` → nodeId→AABB×2 relative to root (fidelity-gate.mjs:29-33),
  plus the Next dev badge. So an UNLEDGERED residual over budget → exit 1 (fails), while a change
  INSIDE a declared-lossy region is masked (doesn't count). That is a genuine "works on any screen"
  machine check — the masked regions are exactly what the converter declared lossy, not hardcoded.
  (Chrome-pixel execution = Codex's half + the documented run-Chrome-from-shell SIGTRAP note.)
- ✅ **Watch error-hold state machine is robust** (bin:205-224): poll version → convert to STAGING →
  promote `staging→outDir` ONLY on green gates (execFileSync throws on a non-zero convert exit); on
  gate failure → **HELD**, outDir untouched (last good build kept), `last=v` so it doesn't thrash the
  same broken version — next edit retriggers. Outer catch swallows probe errors without crashing the
  loop. Correct: broken edits never clobber the last good output.
- ✅ **--allow-stale-dump is safe** (variable-map.mjs:50-63): non-watch keeps HARD refusal
  (StaleDumpError); watch warns + proceeds; an id the stale dump doesn't know → `varRef` undefined →
  emits RAW + conformance report, never a guessed/mislabeled token. Can't silently mislabel.
- ✅ **GLASS calibration method is honest** (SPEC:183-187): measured 4 blur/saturate/brightness
  variants on the live glass band, all within 0.25pp → blur(8px) pinned as TIED-best (not "perfect"),
  residual declared as Figma's irreducible material FILL modulation (no CSS params), stays ledgered.
  Method sound: compare variants, pick tied-best, declare the irreducible residual — not overclaimed.
- ✅ **Opacity 4dp rounding correct** — rounded UPSTREAM in buildIr (ir.mjs:353,
  `Math.round(node.opacity*10000)/10000`, comment cites the `0.800000011920929` noise); emit
  stringifies the clean value. No float noise in output.
- ✅ 35/35 tests · determinism byte-identical · mother gates green (census/canon/reverse OK).

## Findings
### F1 · MED · SPEC doesn't document the fidelity-budget gate or watch mode
GLASS calibration is in SPEC (:183-187) ✓. But the **fidelity-budget gate** — a machine-checked
"any-screen fidelity" property — belongs as a §6 acceptance criterion (residual ≤ budget after
masking ledgered regions), and **watch mode** (a significant new operating mode: staging + error-hold
+ allow-stale) warrants a §0/§2 mention. Doc-completeness, not a correctness issue — the code is right.

## Visual half — Codex per the split
The pixel measurements (mother 4.27 PASS / candidate 8.11 / wrong-screen 16.51 FAIL; the 4-variant
GLASS calibration numbers; the watch live hands-off 3.7s) are Codex's half + require Chrome-from-shell.
My independent contribution: the LOGIC that produces them — gate masking, watch error-hold, stale-dump
safety, calibration method — is verified correct, so the measured numbers rest on sound machinery.
(I did NOT perform a live Figma edit on Dan's board — I won't side-effect a shared design unprompted;
the live acceptance is on record + Codex attacks it.)

## Verdict: PASS (gate logic + watch state machine + calibration method all correct; opacity clean;
determinism; 35/35) + F1 MED (SPEC: add fidelity-gate AC + watch-mode mention). The C6 machinery is
sound. Fold F1; Codex's measured-visual verdict stands independent (both needed).
