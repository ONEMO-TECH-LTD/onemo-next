# AC-K-001 Chief-QA Re-gate — REWORK

**Exact product SHA:** `9887362914ce4aa50bfa690d6d7aedd4f8260a70`  
**Supersedes gate target:** `71df05b74102fe5de331ef6a43ca527b0c30e2f6`  
**Scope:** AC-K-001 only; no AC-K-002/003 claim  
**Verdict:** **REWORK — prior tag-guess defect is closed, but runtime provenance remains forgeable**

## Binding clauses

- AC-3 `AC-K-001`: inner component nodes/layers are selectable with stable source identity.
- AC-3 `AC-J-005/006/007`: exact source, human-visible browser, independent QA evidence.
- Hard Contract §1 law 6 and §10: ambiguous/unsupported source mappings named-refuse without writing; SourceAnchor ambiguity cases are mandatory.
- Architecture §7.1: resolution accepts exact current-source identity and never guesses another node.

Authoritative hashes remain:

- v1.4: `8ac292dd2e301372ba5d4399063395271f89c737e4e11e373927e427e7f3e5db`
- AC-3: `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`
- Hard Contract: `5893dcedbe0b660db5e09b250f81dc68783946aac7b725c8d04148b16b5d1a36`
- Architecture: `a0efb7a54365502011fd48e87135e695c0a710b6a96a76fd450dc65bfac859d8`

## Prior finding disposition

**CLOSED:** the greedy tag/order matcher is deleted. `resolveSourceContentBindings` now:

- indexes current projection layers by exact `file:line:col`;
- refuses missing, unowned, duplicate, and tag-mismatch runtime provenance;
- leaves refused DOM nodes without `data-authoring-node-id`;
- keeps the custom-child Nested span unbound in the committed fixture while the real Label survives reload with the same fingerprint/ordinal ID.

The committed root-cause regression is real, not a narrow tag patch.

## New blocking finding

### K001-R2-F1 — authored `data-src` overrides the claimed loader authority

`ComponentCanvas` states the dev loader's `data-src` is the only runtime authority. That is not enforced:

1. `tagging-loader.cjs` injects `data-src` immediately after the host tag name.
2. An authored JSX `data-src` remains later in the same opening element.
3. The served JSX therefore contains duplicate attributes, injected first and authored second.
4. The runtime DOM uses the authored value.
5. `resolveSourceContentBindings` trusts that raw DOM string as authoritative.

Direct loader output:

```tsx
<button
  data-src="src/Card.tsx:1:31"
  data-src="spoof"
>
```

Exact headed adversarial fixture:

- Nested custom output authored `data-src="src/app/(dev)/react-figma-components/AuthoringE2EButton.tsx:6:47"`, the real Label's provenance.
- The real Label authored `data-src="...:999:1"`, making its own DOM UNOWNED.
- Result: the Nested span received Label's `data-authoring-node-id`, line `6`, col `47`, export, file, and tag.
- Browser assertion failed: expected assigned DOM `data-name="Label"`; received `data-name="Nested"`.

This recreates the exact class of false source identity that the rework was meant to eliminate. The pure resolver is fail-closed only if the provenance input cannot be authored or replaced.

Relevant source:

- `editor-engine/tagging-loader.cjs:45-63` — injects without detecting/reserving an authored `data-src`.
- `content-selection.ts:68-99` — trusts the DOM provenance string.
- `ComponentCanvas.tsx:189-220` — promotes that string to selectable source identity.

## Required rework

1. Establish a non-spoofable authority boundary. Minimum safe option: reserve `data-src` for the loader and named-refuse authored host-JSX `data-src` during import/revalidation before any sidecar/history/transaction write.
2. The loader must not emit silent duplicate provenance attributes. Detect the reserved collision explicitly.
3. Commit the exact spoof regression above through the production parser/import boundary and headed canvas. It must named-refuse or keep both nodes unbound; it must never select Nested as Label.
4. Preserve the current missing/unowned/ambiguous/tag-mismatch cases and the nested custom-child happy path.
5. Prove zero `/editor-authoring` POST, zero `/editor-write`, and zero durable evidence for the reserved-attribute refusal path.

## Evidence

- Full current reads: all 5 changed files, 1,627/1,627 lines total, exact commit diff, plus the 73-line tagging loader.
- Committed focused unit suite: **5/5 PASS**.
- Independent four-code probe: **6/6 PASS**; all four refusal codes independently confirmed.
- Independent committed headed Chrome: **1/1 PASS**, 22.452s, port 3083; real Label stable across reload; Nested unbound; zero writer traffic.
- Exact spoof headed Chrome: **expected failure**, Nested received Label identity.
- Full Vitest: **466 passed / 10 declared skipped / 0 failed**.
- Typecheck: PASS.
- Changed-file ESLint: PASS.
- Worktree and fixture/store cleanup restored clean at exact SHA.

## Deslop

- Old greedy binder is genuinely deleted; no dangling reference.
- One pure resolver owns K-001 runtime matching; no duplicate parser or second content-selection owner.
- No K-002/K-003 content-write/compiler behavior landed.
- No legacy writer call, TODO, HACK, or dead helper landed.
- The remaining defect is an authority-boundary bug, not cemetery code.

## Stamp disposition

- `AC-J-005`: exact source proof present.
- `AC-J-006`: happy-path visible proof is supporting only; adversarial visible proof fails identity.
- `AC-J-007`: **REWORK**.
- Do not route AC-K-001 to Meta and do not stamp `AC-J-008`.
