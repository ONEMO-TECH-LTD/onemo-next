# Framer Components census — Chief-QA reconciliation and closure

**Chief QA:** `@s58-qa` · **2026-07-13**  
**Verdict:** CENSUS CLOSED FOR ENUMERATION; AC-3 MINTED; PRODUCT/FINAL REMAINS OPEN  
**Expert census:** `s58-framer-components-CENSUS-expert-2026-07-13.md` · 85 lines · SHA-256 `96c78a8312caa484ccdb21c641394c10c06a55fce1d6aa90caf866d53a160e82`  
**Base authority:** AC-2 · 264 rows · SHA-256 `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`  
**New authority:** AC-3 · 335 rows · 428 lines · SHA-256 `06294d605b3416a75770c98b9ec0550fc889f4a90f5d08a6ed81074ecf2bea0a`

## Meaning of closure

Closure means the expert's 13-family free-tier own-hands census has been independently read, reconciled, and represented without a known enumerated item disappearing. It does **not** mean the product is complete, the SPEC-PENDING rows are resolved, or any build may self-start. Paid-gated and harness-limited capabilities remain blocking until evidence or explicit Dan disposition under `AC-J-045`.

## Family reconciliation

| Census family | AC-2 coverage retained | AC-3 additions / disposition |
|---|---|---|
| 1 Creation paths | `AC-B-001..004`, `014..015`, `021..027`, `AC-H-030`, `AC-X-001..006` | `AC-B-028..030`: Create From Code entry/shortcut, measured-flow gate, duplicate deep-copy gate |
| 2 Assets | `AC-H-019..040`, `AC-B-016..020` | No duplicate rows; zero-instance Delete, Library submenu, folders, search, preview, and cross-root unknowns remain SPEC-PENDING |
| 3 Edit-in-place | `AC-A-001..008`, `AC-I-005`, `AC-J-019..021` | `AC-A-010`: component-mode zoom submenu measurement; shared Canvas toolbar remains inherited editor surface, not a separate Components command family |
| 4 Variants | `AC-C-001..012`, `AC-D-001..006`, `AC-F-020` | `AC-C-013..024`: exact context surface, Auto Rename, Default Fill, disabled states, main-menu label, selection chrome, layer tags/badge |
| 5 Interactions/transitions | `AC-F-001..029`, `AC-D-002/004`, `AC-L-018` | `AC-F-030..037`: update, explicit delete, multi-row, state-target exclusion, parent picker, transition-delete gate, Delay/Once/Cycle UI grammar; `AC-L-034` gates the existing Style Transition editor |
| 6 Variables | `AC-E-001..042`, `AC-F-023..029` | `AC-E-043..048`: defaults/config, delete, type change, reorder, Insert entry, Scroll Section measurement |
| 7 Instances | `AC-I-001..011`, `AC-E-030..037` | `AC-I-012..026`: exact menu, Default Size, Layout Template, Fit Content, Auto Rename, duplicate/delete/rename, replace measurement, disabled states; `AC-A-009` gates global/library entry |
| 8 Preview | `AC-G-001..004` | `AC-G-005..016`: visible controls separated from unmeasured effects, W/H, resize handles, URL scope, entry-variant gate |
| 9 Right panel | `AC-L-001..028`, `AC-E-034..035` | `AC-L-029..034`: four Accessibility entries, Code Overrides contents gate, Style Transition update gate |
| 10 Main menu/workspace | Component actions map to `AC-B`, `AC-C`, and `AC-J` | Create From Code and Update Primary labels added; CMS/Localization/Analytics/general File/Edit/View workspace commands are outside the Components capability boundary |
| 11 Global/library | `AC-A-005`, `AC-B-012/020`, `AC-H-006/037` | `AC-A-009` requires Dan-workspace evidence; no free-tier absence is treated as parity proof |
| 12 Keyboard vocabulary | Existing operation rows retain their shortcuts where already measured | New `⇧⌘K`, `⌥R`, `⇧A`, `⌘L`, and `⌘;` rows added; full general-editor shortcut sheet remains outside Components scope |
| 13 Cross-root lifecycle | `AC-B-005..008`, `AC-H-033..037`, `AC-I-007..009` | `AC-B-030` and `AC-I-024` block duplicate/replace semantics until measured; existing folder/library/delete/detach gates remain active |

## Source-backed gaps added

AC-3 adds 71 stable rows: `A +2`, `B +3`, `C +12`, `E +6`, `F +8`, `G +12`, `I +15`, `J +7`, `L +6`. No `D/H/K/X` rows were added because the census items in those families already map to AC-2.

The additions include the expert's highlighted gaps: Create From Code, Auto Rename, Set as Default Fill, Set Default Size, Create Layout Template, Add To Agent decision, preview viewport controls, state variants excluded from Set Variant targets, searchable palettes, and the four Accessibility entries. Once/Cycle/Delay behavior already existed as `AC-F-009..011`; AC-3 adds only their newly measured UI grammar.

The different-eyes completeness pass also found items omitted from the expert's candidate summary: exact variant/instance disabled states, variant selection/layer chrome, component-mode zoom submenu, Scroll Section contents, Code Overrides contents, and the existing Style Transition update surface. These are now explicit rows.

## Flagged holds

The following remain deliberately unresolved, never silently green: Create From Code result; blank-create result; zero-instance component Delete; Library/global behavior; folder menus/drag/category/project-global moves; Copy Import module shape; Variable defaults/delete/type/reorder/binding; instance value reset/event row; inner-layer fire-event action; transition parent picker/delete/update details; preview restart/open-new/W/H/entry variant; instance Default Size/Layout Template/Fit Content/Auto Rename/duplicate/delete/rename/replace; Lock/Hide; Add To Agent; Code Overrides; Scroll Section; separate preview thumbnails.

`AC-J-045` is the final safety net: paid or harness-limited access is a HOLD until live evidence or explicit Dan disposition, never an implicit waiver.

## Mechanical proof

- 335 checkbox rows; zero duplicate IDs.
- Every prefix is contiguous: `A10 B30 C24 D6 E48 F37 G16 H40 I26 J45 K13 L34 X6`.
- Reconstructing the pre-annex 333-line body with the AC-2 metadata line produces exact SHA `c00dbb58ba84b64e035ac9ebe66f342ed471471ab33fa4bd4da0f24d4dfc87d3`.
- AC-3 was full-read end to end after final edits; no stale intermediate count, TODO/HACK/FIXME, or duplicate candidate row remains.

## Closure decision

The v1.3 census conditions are met for **enumeration closure**: expert provenance document landed; Chief QA reconciled it into AC-3; Chief QA, as different eyes from the expert, completed a second full census/authority pass. Chief QA declares the census CLOSED at the hashes above.

Final completion remains blocked by every unsatisfied AC-3 row and every SPEC-PENDING/Dan-decision hold. v1.3 itself remains under its separate round-3 contract review; successor v1.4 must bind this exact AC-3 count/hash before build authority can rely on it.
