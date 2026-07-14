# E8 item 9 (hover/tap) — `add-state-rule` WriteOp — s58-lead write-safety verdict

Reviewer: Kai (s58-lead). Requested by @s58-designer. FROZEN HEAD `4c41997` (diff over the E8 PASS
`6111a8d` = lib.ts +23/-0, page.tsx +38, input-behavior.mjs +25). New server WriteOp → full write-
safety gate, not a rubber delta. Method: op guards traced + injection/jail-escape probed + marker-
regex analyzed + existing-CSS-op regression check + G13 layering judged + tsc. @s58-qa runs the live
gate. No code changes (frozen).

## Verdict: **PASS** — the op is injection-safe, jail-safe, parse-guarded, and purely additive (zero regression). One LOW coverage gap (inline-error path ungated).

### Op guards — all sound (`add-state-rule`, lib.ts:980-1000)
- **state enum** `!== 'hover' && !== 'active'` → 422 (matches the type union). ✓
- **localClass** `/^[a-zA-Z_][a-zA-Z0-9_-]*$/` → CSS-identifier only; no `.`/`:`/`{`/`}`/`;`/space →
  the proven payload `1} .evil{` fails on the leading digit. ✓
- **decls** non-empty array → 422. ✓
- **prop** `/^[a-z-]+$/` (no `:`/`{`/digits/space) + **value** `/[{};]/` reject → a value can't close
  the declaration or the rule block, so no rule injection. ✓
- **jailModuleCss(op.file)** → dispatches through `resolveEditorPath` (the F8 `..` traversal guard +
  package-prefix resolution) + requires `.module.css` + CSS_ROOTS. Path-safe, same jail as every css write. ✓
- **postcss.parse(next) BEFORE write** → refuse-not-corrupt: any malformed result (incl. an unclosed
  `/*` comment smuggled in a brace-free value that would otherwise eat a `}`) throws → no write. ✓
- **replace-not-append** (one rule per class+state) → idempotent; repeated commits replace, no unbounded
  growth, and a double-fire would just re-write identical content. ✓

### Injection / jail-escape probe — no surviving vector
Every field an attacker controls on a direct API call is validated *and* backstopped by postcss.parse:
`localClass:'1} .evil{'` → 422 (leading digit); `decls:[['opacity','1} .evil{']]` → 422 (`{`/`}` in
value); `prop:'opacity} .evil {x'` → 422 (`}`/space); `file:'onemo-component-library/../../etc/x.module.css'`
→ 403 (resolver `..` guard); any residue that passes the regexes but breaks CSS → postcss.parse throws → refuse.

### Marker-regex replace path (flagged) — safe
`new RegExp('\\n?' + selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\s*\\{[^}]*\\}')`:
- selector is regex-escaped (`.`→`\.`) AND localClass is already metachar-free by its validator — double-safe, no regex injection.
- `[^}]*` is linear/bounded — no ReDoS.
- Sub-selector edge (`.btnLarge:hover` when class=`btn`, or a `.foo .btn:hover` descendant, or a rule inside a comment/string): `\.btn` then requires literal `:`, so `.btnLarge` can't match; a fragment match on a compound/commented rule could produce odd output — but **postcss.parse(next) guards the whole file → throws → refuse, never corrupt**. Worst case is a loud refusal, not a bad write.

### No regression to existing CSS ops
lib.ts diff is **+23/-0** (numstat) — purely additive: the WriteOp union gained one member and
`applyWrite` gained one `if` block inserted before `add-declaration`. No existing branch
(`add-declaration`/`set-jsx-style`/`bind-token`/`jailModuleCss`) is modified. tsc 0.

### Client flow — sound, honest error
`applyStateRule` resolves the element's REAL class via `editor-resolve` (not a guess), and if there's
no `fallbackRule` (inline-styled element) it emits an honest error and returns — **no fake success, no
write**. Client-built decls are numeric (`parseFloat/100`, `scale(parseFloat)`) so they can't carry
injection even before the server validators. The transition decl (`opacity .15s ease, transform .15s
ease`) is brace/semicolon-free → passes. These are onChange-only fields (single commit per Enter);
add-state-rule replaces, so re-commits are idempotent.

### G13 stub layering (your question) — SOUND
The demo canvas is inline-styled by design, so a real `editor-resolve` returns no `fallbackRule` and
the success path is unreachable live. G13 stubs **both** boundaries — `editor-write` (counts the
`add-state-rule`, returns a 200 stub so **no real module.css is polluted during the audit**) and
`editor-resolve` (a realistic `{fallbackRule:{file:'…module.css', localClass:'stub'}}`) — then asserts
the CLIENT sent exactly ONE op with `state==='hover'` and an opacity decl. That's legitimate isolation:
it gates the client flow (commit→resolve→single correct write) while the OP itself is verified by its
own code guards (above) + the live module.css proof. It does **not** greenwash — the write stub still
inspects the real op payload, and the stub avoids corrupting a real file. The layering is the right call.

## LOW — coverage gap (not blocking)
**F-i9a · LOW · the inline-styled honest-error path is ungated.** G13 stubs `editor-resolve` to ALWAYS
return a `fallbackRule`, so the "no class → honest error, zero writes" branch (the anti-fake-success
guarantee you call out) isn't proven by a gate. **Fix:** a G14 symmetric to G12 — stub `editor-resolve`
to return `{fallbackRule: null}`, commit Hover, assert **zero** `add-state-rule` writes. Cheap, and it
locks the "inline → no fake success" contract you designed.

## Bottom line
`add-state-rule` is a clean new write surface: enum/class/prop/value validators reject every injection
vector, `jailModuleCss`+`resolveEditorPath` keep it path-safe, the marker-regex replace is escaped +
bounded + postcss-backstopped (refuse-not-corrupt), and the diff is purely additive with zero
regression to the existing CSS ops (tsc 0). The client resolves the real class and fails honestly on
inline-styled elements, and G13's stub layering soundly isolates the client flow from the demo canvas.
**PASS on my write-safety lens @ `4c41997`.** Fold F-i9a (G14 inline-error gate) whenever — LOW, doesn't
reopen the gate. Codex's live gate runs independent (its earlier "one manual failure" verdict still
pending its return).
