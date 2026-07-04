# react-figma Engine Plan — v1

> Directive: Framer/Onlook functionality — editing React/CSS code via UI controls (visual coding), inspecting, building with it. Figma is the UI skin because it's the better, familiar UI. Variables = our tokens CSS (converter outputs), not Figma variables. Surgical edits like Figma: change a value, assign a variable — never pollute or restructure source.
>
> Status: PLAN — no engine code until Dan signs off. Linear: KAI-9302 (epic) / KAI-9303 (Sprint E1) / KAI-9304–9307 (tasks).

## 1 · What was studied (evidence)

Clean Onlook clone `onemo-dev/onemo-next-editor` (verified precisely: local `main` is 0 behind / 9 ahead of `upstream/main` (onlook-dev/onlook); local `main` is 7 ahead of `origin/main` (ONEMO-TECH-LTD fork remote). The 9 commits are the local-SDK impostor seam — additive `local-csb-sdk/` + 14 seam-edited upstream files, core logic untouched). Files read in full:

| Organ | File | Mechanism |
|---|---|---|
| Identity/tagging | `packages/parser/src/ids.ts` | Babel pass writes `data-oid` attrs INTO source files, persisted to disk. Random 7-char ids; conflict handling across branches. |
| Layer tree | `apps/web/preload/script/api/dom.ts` | TreeWalker over live DOM → `LayerNode {domId, oid, tagName, textContent, component, isVisible, parent, children}`; debounced 500ms; published to editor. Runtime `data-onlook-dom-id` assigned per element for addressing. |
| Style read | `apps/web/preload/script/api/elements/style.ts` | `{computed: getComputedStyle, defined: inline ⊕ matched stylesheet rules}` — matched rules found by walking `document.styleSheets` + `element.matches(selectorText)`. |
| Live override | `apps/web/preload/script/api/style/css-manager.ts` | ONE injected `<style>`; css-tree AST; rule per `[data-onlook-dom-id=X]` selector; update/remove/clear. This is the staging layer — instant preview, no rebuild. |
| Panel model | `apps/web/client/src/components/store/editor/style/index.ts` | `StyleManager`: selection reaction → `SelectedStyle {styles{defined,computed}, rect, parentRect}`; every control change → `UpdateStyleAction {targets:[{domId, oid, change:{original, updated}}]}` → action.run (live override + queued code write). `original` carried for undo. Root vs Instance mode. |
| Code write | `packages/parser/src/code-edit/transform.ts` + `style.ts` | oid→`CodeDiffRequest` map; parse file → traverse → merge Tailwind classes into `className` (twMerge) / set props / structure ops → regenerate whole file → prettier → write. |
| Bridge | `apps/web/preload/script/api/index.ts` + `packages/penpal` | iframe child exposes ~40 methods (processDom, getElementAtLoc, updateStyle, drag, editText…) over penpal RPC. |

## 2 · Where we deviate, and why

| Onlook | Ours | Why |
|---|---|---|
| `data-oid` written into source files (pollution; 29-file diffs in the framer bet) | **In-memory tagging**: dev-only webpack pre-loader splices `data-src="relFile:line:col"` into the *served* compile only. Repo bytes untouched (`git status` clean is an AC). | Surgical principle. Identity IS the source location — deterministic, no random ids, no persistence problem. |
| Random oid = stable cross-session identity | `file:line:col` valid per build; re-resolved after every HMR | We re-read truth after every write anyway; stable-forever ids are only needed if the editor owns state across sessions — it doesn't, the code is the state. |
| Style writes = Tailwind `className` merge (the slop route for our codebase) | **CSS-module declaration edit**: value swap or `var(--token)` assignment at the exact declaration, string-splice, format-preserving. Token *values* → converter loop (owned, untouched). | Our styles live in `.module.css` + tokens. The diff must read like a human wrote it. |
| Whole-file babel regenerate on write (hit the identifier-mangling bug) | **No JSX regeneration in v1 at all.** CSS files edited by byte-splice at postcss-located positions. | Regeneration churns untouched lines; splice edits only what changed. |
| Editor = separate app owning projects/sandboxes | Editor = dev route in the same Next app; canvas = same-origin iframe of the real route | Same-origin kills the RPC layer's complexity budget: direct `contentDocument` access, no penpal needed for v1. |

Kept from Onlook (proven, we adopt the shape): layer-tree walker + debounced publish, `{defined, computed}` style read, single-stylesheet override staging, `{original, updated}` change actions (= free undo), preload-methods catalog as the bridge API checklist.

## 3 · Architecture — 4 modules

```
┌───────────── react-figma page (Figma-spec UI, exists) ─────────────┐
│  layers panel │ inspector sections │ variables section             │
└──────┬────────────────┬────────────────────┬───────────────────────┘
       │ LayerNode[]    │ StyleReport        │ command:{override|commit}
┌──────┴────────────────┴────────────────────┴───────────────────────┐
│ M2 dom-sync (bridge, runs in editor page; canvas = same-origin     │
│ iframe of the real route)                                          │
│   walker → LayerNode map · style read → StyleReport ·              │
│   hover/click → SelectionPayload · M3 override stylesheet in canvas│
└──────┬──────────────────────────────────────────────┬──────────────┘
       │ data-src attrs (served output only)          │ WriteOp (POST /api/dev/editor-write)
┌──────┴──────────────┐                    ┌───────────┴──────────────┐
│ M1 selection-core   │                    │ M4 write-engine (dev API │
│ webpack pre-loader, │                    │ route, fs whitelist jail)│
│ dev-only, in-memory │                    │ module.css splice ·      │
└─────────────────────┘                    │ token JSON → converter   │
                                           └──────────────────────────┘
```

### M1 selection-core (KAI-9304)
Webpack `enforce:'pre'` loader on `src/**/*.tsx`, dev-only, both compilations (SSR+client agree → no hydration mismatch). TypeScript compiler API (`ts.createSourceFile`, guaranteed dependency) walks JSX opening elements; for **lowercase/host elements** splices ` data-src="rel:line:col"` right after the tag name. Splice-only — no codegen, byte-order preserved, no added lines. Excluded from prod builds by the `dev` flag; AC: `git status` clean while serving.

**PINNED (verified):** `package.json` dev script is bare `next dev` → **Turbopack** in Next 16, where webpack loaders never run. The editor-target dev server MUST run `next dev --webpack` (consistent with the build script, which is already `--webpack`). This is the run command, not a config change.

### M2 dom-sync + M3 override (KAI-9305, KAI-9306)
Editor page owns the iframe (`/effect-creator/v5.3.1/…` first target). Same-origin: direct `contentDocument`.
- **Layer tree**: TreeWalker (Onlook's filter list adopted), debounced 300–500ms, MutationObserver retrigger. → layers panel replaces `TREE` mock.
- **Style read** on selection → `StyleReport`:
  - `computed`: getComputedStyle subset (the properties the panel shows)
  - `defined`: inline ⊕ matched rules (styleSheets walk + `el.matches`) — **declaration value text preserves `var(--…)` unresolved** while computed has the resolved value. That pair IS provenance: `defined.padding = "var(--sem-dim-fluid-standard-m)"` → token pill (name = token path, converter naming); no `var()` → raw value, shown as raw.
  - `sourceRef` — **PINNED algorithm** (no stylesheet-universe guessing): `data-src` names the component file → parse that file's `*.module.css` imports (one or two per component) → **server-side resolver** (`/api/dev/editor-resolve`, same postcss authority as the write engine) parses those files → matches the element's hashed runtime class back to its local name (dev localIdent embeds it) → returns a full `DeclRef` per property (file, selector, at-context, ruleIndex, byte range of the value — duplicate selectors like the two `.status` rules in `outline-editor.module.css` are disambiguated by ruleIndex + byte range, never re-found by text search). Owner of a property = **true CSS cascade resolution: importance → specificity → source order** (not a naive last-stylesheet walk); inherited properties resolve to the ancestor owner (§5).
- **Override staging (M3)**: one injected constructable stylesheet in the canvas doc; rule per runtime dom-id attr (assigned by the walker, DOM-only, never source). **Every override declaration carries `!important`** — the staging layer must beat any specificity including inline `style=`, or previews silently fail on inline-styled elements. Control change → `override(domId, prop, value)` <50ms. Dirty ledger per element+prop with `{original, updated}` (undo/discard = restore original). HMR reload → overrides drop, dirty ledger re-reported.

### M4 write-engine (KAI-9307)
Dev-only API route in the same Next app (`/api/dev/editor-write`), hard-gated `process.env.NODE_ENV === 'development'`, path whitelist: `src/**/*.module.css` + token source. Ops:

1. `set-declaration` / `set-shorthand-slots` — consume the resolver's `DeclRef` verbatim: verify `valueRange` bytes still equal `valueText` (concurrency guard), then **byte-splice** the value range. No selector re-finding at write time. `add-declaration` → insert after the last declaration of that exact rule, file indentation matched. Prettier-idempotence is an AC (write is format-clean).
2. `bind-token` — same splice, value becomes `var(--<token>)`. Panel validated the token exists (variables section data).
3. `set-token-value` — **PINNED topology (verified from `tokens.config.mjs`)**: source of truth = `onemo-ssot-global/11-design-system/figma-var/DS-V2.3.12--1-JULY-2026.json`; the editor edits that JSON (in an SSOT worktree per worktree-only rule), then runs `build-scan.mjs --consumer-root <dev-root-of-our-app-worktree>` — the converter already fans out `css/tailwind/react` into `onemo-next/src/app/tokens/` in one run, and `--consumer-root` exists precisely to retarget into worktrees. No converter logic in the editor, no new plumbing.

Commit flow: override active → POST WriteOp → fs write → HMR recompiles canvas → dom-sync re-reads truth → override for that prop dissolves → panel now shows the *persisted* value. If re-read ≠ intended → surface a conflict chip, never silently retry.

## 4 · Data contracts (v1) — QA-hardened (meta-QA findings 1, 3, 4)

**Resolver runs server-side** in the same dev API as the write engine (`/api/dev/editor-resolve`) — ONE postcss authority produces `DeclRef`s; the write engine consumes them verbatim. M2 sends `{file (from data-src), classes, props}`; no client-side CSS parsing, no selector re-finding at write time.

```ts
type DeclRef = {                    // EXACT declaration identity — resolver output, write input
  file: string                      // repo-relative *.module.css
  localClass: string                // un-hashed local class name
  selector: string                  // selector text as written in the file
  atContext: string[]               // outer→inner at-rule chain, e.g. ['@media (max-width: 480px)']
  ruleIndex: number                 // nth rule in FILE matching {selector, atContext} — duplicate
                                    // selectors (e.g. two `.status` rules) are disambiguated here
  prop: Prop
  valueRange: { start: number; end: number }  // FILE BYTE offsets (Buffer), NOT JS string
                                              // (UTF-16) indexes — resolver + splicer both
                                              // operate on the same Buffer representation
  valueText: string                 // exact current value bytes — doubles as expectPrev
  important: boolean
}

type SelectionPayload = { domId: string; file: string; line: number; col: number;
  tag: string; classes: string[]; rect: DOMRect; parentRect: DOMRect }

type StyleReport = { domId: string;
  computed: Record<Prop, string>;   // resolved truth
  defined:  Record<Prop, {
    value: string;                  // raw text, var() preserved
    token?: string;                 // parsed from var(--…)
    inheritedFrom?: { domId: string; selector: string };  // owner ELEMENT when value is inherited
    decl?: DeclRef;                 // absent ⇒ not writable v1 (inline / global / utility)
    shorthand?: { prop: Prop; slots: string[]; slotIndex: number };
                                    // owner is a shorthand: original slot TEXTS (var() verbatim)
                                    // + which slot this longhand maps to
  }> }

type OverrideOp = { domId: string; prop: Prop; value: string; original: string }

type WriteOp =
  | { kind: 'set-declaration';    decl: DeclRef; newValueText: string }
      // splice decl.valueRange after verifying bytes === decl.valueText (concurrency guard)
  | { kind: 'set-shorthand-slots'; decl: DeclRef; slots: string[] }
      // whole-VALUE splice rebuilt from slot texts (see §5 shorthand rule)
  | { kind: 'bind-token';          decl: DeclRef; token: string }
  | { kind: 'add-declaration';     file: string; localClass: string; selector: string;
                                   atContext: string[]; prop: Prop; valueText: string }
      // insertion point = after last declaration of that exact rule, file indentation matched
  | { kind: 'set-token-value';     tokenPath: string; theme?: string; value: string | number }
      // theme required for multi-mode (Light/Dark) tokens; single-mode omits it
```

**Token-write operational boundary (pinned):** server env config — `EDITOR_SSOT_WORKTREE` (the SSOT worktree holding the canonical figma-var JSON), converter cwd = `<ssot-worktree>/tools/ds-pipeline`, `--consumer-root` = dev-root of THIS app worktree. Known side effect, accepted: `build-scan.mjs` also rewrites `ssotRefDir` (`11-design-system/token-outputs/`) inside the SSOT worktree on every run — that's the converter's committed-reference behavior, lands in the worktree, ships later via normal PR. The write jail whitelist therefore = `src/**/*.module.css` (app worktree) + figma-var JSON + token-outputs (SSOT worktree). Nothing else.

## 5 · Known hard cases — answers up front

| Case | v1 answer |
|---|---|
| Line drift after any write/HMR | Identity re-resolved every recompile (tags regenerate). Never cache `file:line` across writes; `expectPrev` guards the race. |
| Shorthand vs panel longhand — incl. token shorthands like `padding: var(--spacing-2xs) var(--spacing-l)` (real case: `toolbar.module.css:14`) | **Slot-preserving rewrite, pinned:** resolver splits the shorthand into slot TEXTS (var() kept verbatim) and maps each panel longhand to its slot. An edit rebuilds the slots array client-side — minimal canonical expansion (1→2→4 slots) ONLY as far as the edit requires, untouched slots keep their ORIGINAL text (a var slot is never converted to px). Written as `set-shorthand-slots` (whole-value splice). Never expand to longhand declarations; never write computed px into untouched slots. Example: edit padding-left on `var(--a) var(--b)` → `var(--a) var(--b) var(--a) 12px`. |
| Inherited properties — selected `<span>` shows color/font from ancestor `.tool` (real case: `Dock.tsx:27-28` ← `toolbar.module.css:26-38`) | **Ancestor-owner walk, pinned:** for the CSS-inheritable set (color, font-*, line-height, letter-spacing, text-*, cursor, visibility — enumerated in code), when no matched rule on the element defines the property, the resolver walks UP the ancestor chain's matched rules to the owning declaration. `defined.inheritedFrom` carries the owner element + selector; the panel shows an "inherited from `.tool`" chip. Editing targets the OWNER's DeclRef (that is the truth of where the value lives) — never a new local declaration that shadows it. |
| Media queries / breakpoints | v1 reads truth at current canvas width; writes target the rule that matched (its @media context comes with the postcss position). No breakpoint UI yet. |
| hover/active/pseudo styles | Out of v1 (Figma-canon panel has no state switcher yet). Matched-rule read ignores non-matching pseudos. |
| Multiple classes / specificity | The matched-rules walk returns rules in cascade order; the LAST writer of a prop is the owner — that's the rule we edit. Panel shows owner selector in the provenance tooltip. |
| Inline `style=` on JSX | Read + shown (defined.inline wins cascade); WRITE to it is out of v1 (that's a JSX edit). Chip marks it "inline — edit in code". |
| Global (non-module) CSS owner | Read + provenance shown; write blocked by whitelist in v1 (globals are shared blast radius). |
| tokens var chain (`var(--a, var(--b))`) | Token pill shows the outermost var; chain display deferred. |
| Styled via `tokens.tailwind.css` utilities | Same as global CSS: visible, not writable v1. |
| Token-file HMR after a converter run — **discovered live (E1.4)**: webpack's persistent cache does NOT invalidate when tailwind-v4-inlined `@import "./tokens/tokens.css"` changes on disk (survives touch of the importer AND server restarts) | Workaround: clear `.next` + restart to pick up converter output (verified: canvas then computes the new value). Real fix belongs to the token-foundation work (KAI-9288): serve tokens outside the tailwind inline path (runtime `<link>`) or land the upstream dependency registration. Documented, not silently patched. |
| COOP/COEP on the canvas route — `next.config.ts:8-24` sets COOP+COEP on `/effect-creator/:path*` and COEP on `/_next/*` | COOP is top-level-only so same-origin iframing *should* work — but this is an **explicit E1.2 AC, not an assumption**: verify iframe load, `contentDocument` access, and subresource loading under these exact headers before any M2 code builds on it. Documented fallback if it fails: dev-only header exemption for the editor-embedded variant of the route (config change, PR'd). |

## 6 · Non-goals v1 (explicit)

JSX/structural edits (insert/move/remove/group) · component-vs-instance mode · breakpoint editor · pseudo-state editor · text editing · multi-select edits · agent-chat integration. Each is a later sprint on top of the same contracts (Onlook's `CodeDiffRequest`/action catalog is the reference for when we get there).

## 7 · Verification (maps 1:1 to Linear ACs)

- **M1**: served DOM carries `data-src`; `git status` clean; prod build greps zero `data-src`.
- **M2**: layers panel = live DOM of the canvas; selecting an element fills Position/Layout/Appearance/Fill with ITS values; one token-bound + one raw property demonstrated live; **COEP smoke first** — iframe of `/effect-creator/*` loads, `contentDocument` accessible, subresources load under the COOP/COEP headers; **inheritance demonstrated** — selecting a text child (e.g. a toolbar label span) shows the ancestor-owned color/font with the owner chip.
- **M3**: control → canvas <50ms with zero disk writes; discard restores exactly; HMR drops overrides.
- **M4**: padding commit → `git diff` = exactly one changed line; bind-token → declaration becomes `var(--…)` and pill appears from re-read; token value edit → converter runs, all consumers update; out-of-whitelist write rejected; prettier idempotent on touched file.
