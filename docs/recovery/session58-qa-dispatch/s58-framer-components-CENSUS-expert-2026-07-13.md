# FRAMER COMPONENTS — FULL CAPABILITY CENSUS (parity-census law, v1.3 §★)
**Census-taker:** @s58-expert · **2026-07-13** · authenticated Framer, scratch project "Powerful Autonomy" (NodeCard/QAFrame), own hands, real pointer/keyboard, screenshots in session transcripts (ss_ ids inline where fresh today).
**Completeness bar (per v1.3):** free-tier own-hands UI surface. Paid-gated + harness-limited items are ENUMERATED + FLAGGED (⧗M = needs-manual/Dan-hands · ⧗P = paid-gated). Flagged ≠ gap.
**Provenance legend:** **[L-today]** measured live 2026-07-13 · **[L-prior]** measured live in an earlier dated pass (extraction ledger / live-probe / 4-area extraction docs) · **[STD]** Framer-standard expectation, NOT operated — treat as unverified · **[DOC]** official Framer doc link captured in-product.
Chief-QA reconciles this census vs AC-2 → gaps become AC-3 rows. **Only source-backed rows below qualify; [STD] items need extraction before they can become AC rows.**

---

## 1 · CREATION PATHS (three, not one)
| # | Capability | Provenance |
|---|---|---|
| 1.1 | **Create from selection** — ⌘⌥K / menu "Create Component…" (context-gated: needs an eligible page-layer selection), one transaction: naming dialog → layer becomes an instance | [L-prior] + menu entry [L-today] |
| 1.2 | **Blank create** — Assets → Components "+" → **New Component** → Title dialog ("Components can be edited in their own canvas. Double-click on any instance to add visual variants and interactions." · Create disabled until non-empty title) | [L-today] ss_8414b177z/ss_02047dyjv (dialog measured; final created-state = [STD], one manual confirm) |
| 1.3 | **Create From Code… ⇧⌘K** (main menu → Component ›) — code-component creation path. **NOT in any prior extraction/AC.** | [L-today] ss_2810j6eki (menu entry measured; the flow itself ⧗M) |

## 2 · ASSETS PANEL (Components at home inside Assets — NOT a dedicated page)
- Panel tabs: Pages · Layers · **Assets**; Assets sections **Templates · Components · Styles · Vectors · Code**, each with own "+" · top **Search…** field. [L-today]
- Components section = **folder tree**: collapsible folders (`▸ 📁 Project`), rows = ◈ icon + name **list rows (no thumbnails in this view)**; folder hover "…" actions affordance. [L-today]
- Components "+" menu: **New Component · New Folder · Sort Alphabetically**. [L-today]
- Component right-click menu (identical grammar to breadcrumb-chip menu [L-prior]): **Insert · Edit · Find · Rename · Duplicate · Delete · Library › · Copy Import · Copy URL** — **Delete DISABLED with a live instance (measured)**; zero-instance Delete state ⧗M; Library › contents ⧗M/⧗P. [L-today]
- Folder "…" menu contents ⧗M (resisted synthetic click) · drag-component-into-folder ⧗M (harness drag limit) · Insert-panel component PREVIEW rendering ⧗M.

## 3 · EDIT-IN-PLACE (one canvas)
- Entry: dbl-click component in Assets / Edit (ctx) / **Edit Component button on an instance's panel** [L-today] / dbl-click instance [L-prior]. Same infinite canvas at `?node=<id>`, page fully hidden, ONLY that component's variants. [L-prior, re-confirmed L-today]
- Breadcrumb top-bar chips `[📄 Home] › [◈ Name]` — Home=neutral chip exits; component chip = accent, opens component menu (not nav). [L-prior]
- Exit: Home chip [L-today via "Back to the page"] · reload does NOT lose data; edit context restore = `?node=` URL-scoped [L-today: preview used &view=preview URL — node URLs are shareable/restorable].
- Canvas bottom toolbar (edit mode): **Select · Pan · Comment · Theme (light/dark) · zoom % control · (Upgrade Now)**. [L-today, a11y-tree]
- Zoom submenu/options button present; exact items ⧗M.

## 4 · VARIANTS (free frames)
- Primary = name-suffix `· Primary`, accent label; Layers rows carry right-aligned **Primary/Variant tags** + ⚡ badge on rows with interactions [L-today ss_0161sgiqz]. Unselected frames NO border; selected = accent outline + 4 corner handles + right-edge ⚡ connect handle + pivot dot. [L-prior + L-today]
- One row x=0/495/990, 395w ~100px gaps, free x/y/w/h; +Variant ghost right-of-last (selection-scoped); state ghost below (selection-scoped) → **Hover / Pressed** choice. [L-prior, ghosts re-seen L-today]
- **Variant ctx menu (linked variant), full [L-today ss_9125scqbr]:** Add To Agent · **Show Primary · Detach From Primary · Update Primary · Reset Overrides** · Fit Content(dis) · Select› · Align›(dis) · Copy› · Paste› · Move› · Duplicate ⌘D · Delete ⌫ · Rename ⌘R · **Auto Rename ⌥R** · Lock ⌘L · Hide ⌘; · Overflow› · Add Frame/Add Stack/Remove Frame(dis) · **Set as Default Fill**. Menus = searchable palettes ("Type to search…").
- Main-menu Component › gives the fuller label **"Update Primary From Instance"** [L-today ss_2810j6eki] — lineage semantics: push an instance's overrides back into primary.
- Rename = select→click-label → inline edit [L-prior]; ⌘R shortcut [L-today menu]; **Auto Rename ⌥R exists — never previously extracted**.

## 5 · INTERACTIONS / TRANSITIONS (watchlist a — UPDATE/DELETE measured)
- Interactions "+" → exactly **New Transition · New Event**. [L-today ss_1165c8ox5]
- **Set Variant popover = create AND update surface (all fields editable post-create) [L-today, DOM-exact]:** `On` select = **onTap(Click) · onTapStart(Click Start) · onAppear(Appear) · onMouseEnter(Mouse Enter) · onMouseLeave(Mouse Leave)** (re-confirmed today at value level) · `Delay` textbox + −/+ steppers (seconds) · `Transition` **Once|Cycle** · `Variant` target select = **config variants only, stable node IDs — state variants (·Hover) are NOT offered as targets** (new model fact). Popover has **Back** (→ parent action-picker level, contents ⧗M — resisted synthetic nav) + Close.
- DELETE: row ✕; on an inherited row = "Reset…" (override-aware InteractionOverride, ⌘Z restores) [L-prior]. Multi-row per variant [L-prior].
- Implicit state wires: Hover/Pressed frames auto-wire from parent with EMPTY Interactions panel (stateKind IS the trigger — never synthesize an edge) [L-prior]. Wires STRAIGHT, arrowhead at target, selection-scoped overlays; ▶ badge on variant labels with an effective interaction [L-prior + L-today ss_0161sgiqz].
- Per-variant **Transition spec (Styles section): Instant · Ease · Spring(Time: Duration/Bounce/Delay | Physics: Stiffness/Damping/Mass/Delay)** — 4 forms [L-prior]; transition UPDATE = reopen the Styles Transition control [L-today: "Transition Spring" row present; full editor re-walk ⧗M quick].

## 6 · VARIABLES = PROPS + EVENTS (one model; watchlist c partial)
- Sheet "«Component» Variables": left = defined variables w/ kind icons; right = selected variable form; "+" = searchable 15-kind palette: **Plain Text · Formatted Text · Date · Link · Image · Color · Toggle · Number · Option · Event · File · Transition · Border · Cursor · Shadow**. [L-today, list complete — no scroll past Shadow]
- Event create + inline RENAME measured (Click→CardTapped, persists across sessions) [L-today]. Official doc link in-product: framer.com/support/using-framer/event-variables/ [DOC].
- **Lifecycle beyond create/rename (watchlist c): ⧗M** — per-kind default/config forms, variable DELETE, type-change, reorder: not operable synthetically this pass (menu clicks eaten); extract at the E-slice per contract SPEC-PENDING. Left panel also has an Insert-menu **Variables** tab [L-today, a11y].
- Entry points: Interactions + → New Event; left Insert › Variables; (property-exposure from a layer, e.g. "expose text as variable" — ⧗M, not yet located this pass).

## 7 · INSTANCES (watchlist e partial)
- **Instance panel section [L-today zoom]:** header `Name` + grey `Component` tag · **Variant [dropdown]** · **Trigger [⚡ Add…] = PAID Convert add-on (upsell measured) — NOT event UI ⧗P** · **[Edit Component]** · collapsed **Scroll Section +** · **Code Overrides +**.
- **Instance ctx menu, full [L-today ss_3146dqant]:** Add To Agent · Edit(↵) · Set Default Size(dis) · **Detach Instance** · Create Layout Template · Fit Content ⇧A · Select› · Align› · **Replace With › · Replace All Instances With ›** · Copy› · Paste› · Move› · Duplicate ⌘D · Delete ⌫ · Rename ⌘R · Auto Rename ⌥R · Lock ⌘L · Hide ⌘; · Overflow›(dis) · Add Frame · Add Stack · Remove Frame(dis).
- Replace-With/Replace-All SUBMENU contents + actual replace behavior (watchlist e): ⧗M (submenu hover flaky synthetically; needs one manual pass with 2 components + 2 instances — my scratch has both ready).
- Delete-guard: component Delete disabled while instances exist [L-today]; value-prop rows on instance + reset-to-default ⧗M; event (CardTapped) row did NOT surface on the instance panel pre-wiring [L-today — behavior open, ⧗M].

## 8 · PREVIEW / PLAY (watchlist b)
- ▶ (top bar) → **URL-scoped preview `&view=preview`** [L-today ss_5007g5ig0]: top bar = **[‹ Back] · ↻ restart/refresh · ↗ open-in-new-tab · W field · H field** (resizable viewport, drag rails + bottom handle); component runs LIVE centered.
- Beyond Play/Back (watchlist b): restart = ↻ [L-today]. **Entry-variant control: NOT PRESENT in the preview chrome** [L-today — no variant selector; which variant is the entry (primary vs selected) could not be visually distinguished on my identical-looking variants → ⧗M one manual check with visually distinct variants]. Stop = Back/close tab. No other controls present free-tier.

## 9 · PER-NODE RIGHT-PANEL SECTIONS (variant selected, edit mode) [L-today ss_0161sgiqz]
**Interactions · Link (Link To: Page or URL) · Position & Size (Position/W/H w/ Fixed|Relative|Fill|Fit Content(|Viewport for H) + Min Max) · Layout · Effects · Overlays · Cursor · Styles (Transition · Opacity · Visible Yes/No · Fill · Overflow Clip/Visible/Hidden/Scroll · Radius (+per-corner) · Rotate · Border · Shadows) · Accessibility · Code Overrides.**
- **Accessibility "+" menu = Tag · Aria Label · Tab Index · Google Bot** [L-today ss_87909h0av] — never previously extracted, no AC row known.
- Code Overrides section on nodes/instances [L-today] — ⧗M contents.

## 10 · GLOBAL / MAIN-MENU + WORKSPACE SURFACE [L-today ss_8188l3hz2]
- Top-left main menu: workspace switcher **Canvas ⌥1 · CMS ⌥2 · Localization ⌥3 · Analytics ⌥4 · Settings ⌥5 · Go to Dashboard · Quick Actions ⌘K** + submenus **File › Edit › View › Tool › Layout › Text › Vector › Component › Plugins › Code › Preferences › Help › Your Account**.
- **Component › submenu [L-today]: Create Component… ⌥⌘K (context-gated) · Create From Code… ⇧⌘K · Show Primary · Detach From Primary · Update Primary From Instance · Reset Overrides.**
- Submenu trees of File/Edit/View/Tool/Layout/Plugins/Code: ⧗M (enumerable in one manual sweep; mostly non-Components scope).
- Top bar: project name · branch chip `main` · avatar · ▶ preview · Invite · Publish. Version history / branches in build menu ⧗M/⧗P.

## 11 · GLOBAL / LIBRARY COMPONENTS (watchlist d)
- Free scratch has no team library; built-in Insert-panel library components + marketplace = **⧗M/⧗P**: entry/read/edit behavior of NON-project (library/global) components not operable in this project — needs one pass in Dan's real workspace (ONEMO's "Global library" analogue). Known [L-prior]: our DemoButton double-click parity target relies on this seam — flag prominently for AC-3.
- Library › ctx submenu (publish/move) ⧗M/⧗P.

## 12 · KEYBOARD VOCAB (measured from menus today)
⌘⌥K create-from-selection · **⇧⌘K create-from-code** · ⌘D duplicate · ⌫ delete · ⌘R rename · **⌥R auto-rename** · ⌘L lock · ⌘; hide · ⇧A fit content · ⌘K quick actions · ⌥1–5 workspace switch · ↵ edit (instance). Full shortcut sheet ⧗M (Help › likely).

## 13 · CROSS-ROOT LIFECYCLE (watchlist e remainder)
Component moved/renamed across folders; project↔library moves; what happens to instances when a component is deleted after Detach; Duplicate semantics (deep copy incl. variants/interactions?) — **all ⧗M**: enumerated, not operated (each is a state-mutating op needing a throwaway project pass; my scratch can host it on dispatch).

---
## NEW-vs-AC-2 candidates (my read — Chief QA reconciles authoritatively)
Likely NOT in AC-2 (source-backed today): **Create From Code… ⇧⌘K** · **Auto Rename ⌥R** · **Set as Default Fill** · **Set Default Size** (instance) · **Create Layout Template** · **Fit Content ⇧A** · Lock/Hide on variants+instances · **Accessibility (Tag/Aria Label/Tab Index/Google Bot)** · Code Overrides section · Scroll Section · **Add To Agent** (AI surface — product decision whether to clone) · preview W/H resizable viewport · Once|Cycle transition repeat + Delay steppers (if AC has only trigger/target) · state-variants-not-valid-targets rule · searchable-palette law for ALL menus · workspace-level surfaces (CMS/Localization/Analytics — out of Components scope, listed for completeness).
**Superseded assumptions confirmed (per your note):** Components lives INSIDE Assets (no dedicated mandatory page) ✓ measured; instance Trigger = paid Convert ✓ measured.
**Census status: OPEN** — free-tier own-hands sweep complete per the v1.3 bar; ⧗M/⧗P items enumerated above await their manual/owning-slice passes; closure = Chief-QA reconciliation + completeness pass per v1.3 §★.
