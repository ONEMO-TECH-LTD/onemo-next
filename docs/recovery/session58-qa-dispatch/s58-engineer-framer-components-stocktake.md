# DISPATCH — Framer Components + Assets stock-take → gap analysis vs our react-figma editor

**From:** @s58-designer (Kai) · **Report to:** @s58-designer ONLY · **Scope:** RESEARCH / stock-take + gap analysis. NO code changes in this task — deliverable is a written analysis. One recipient, report up to me only. You do not spawn sub-agents. This prompt is self-contained.

## Why
Dan's directive: our **Components** page must be a **self-sufficient component-creation surface like Framer's** — create + manage + insert components entirely inside it. Today it is NOT: component *creation* and the insertable component *library grid* live in the **Assets** page's "Components" tab, and the Components rail is read-only navigation that literally says "create one from the Assets panel." That is the Framer-wrong split Dan is calling out. **Assets must be images/icons/other assets only — NOT components.**

## Our current state (the baseline to gap against)
File: `onemo-next/src/app/(dev)/react-figma/page.tsx` (worktree `.claude/worktrees/s58-figma-engine`, branch `session58-task/react-figma-engine`).
- **Components rail** (`ComponentsRail`, ~line 2211): read-only navigator. Sections `Global library` / `Project` → categories → components → variant children. Clicking jumps the canvas gallery to the frame + selects it. Empty state: "No components yet — create one from the Assets panel." NO create, NO insert, NO manage here.
- **Assets page "Components" tab** (`rail === 'assets'`, ~line 3734): this is where creation lives — a `New component` form (name + Project/Global library dropdown + optional category → `newComponent()`), a search-components box (non-functional placeholder), and the insertable `dsComponents` tile grid (`insertAsset()`). Assets also has Images + Icons tabs.
- Data source: `useDsComponents()` (dual-root inventory via `/api/dev/editor-components`).

## Your task — take stock of FRAMER, then produce the gap list
Framer project is open in the shared Chrome (tab title "Dandy Researchers – Framer", URL `https://framer.com/projects/Dandy-Researchers--ERKxQ4Q9QQetstslsQp9-94Ooh`). Take stock of BOTH:
1. **Framer's Components/Assets panel** — how Framer surfaces components: where you create a component, the create flow (menu items, options), how components are organized (sections/categories/nesting), search, insert-into-canvas, variant/props handling, right-click actions, rename/delete/duplicate, drag-to-canvas, detach.
2. **Framer's Assets** — what Framer actually puts under Assets (does it mix components in? images? colors? — Dan's point is components should NOT be there).

Method (your choice, whichever you can reach): click-through + reading Framer's console/DOM, or programmatic extraction of the panel structure. If you CANNOT reach the live Framer tab from your environment (no shared browser), SAY SO immediately in your reply and I (@s58-designer) will run the console extraction on the live tab and hand you the raw DOM/structure dump — do not fabricate Framer behaviour you haven't observed.

## Deliverable (write to a file, DM me the path)
`__qa-dispatch/s58-framer-components-gap.md` containing:
- **A. Framer observed** — verbatim structure of Framer's component surface + assets surface (what you saw/extracted, with evidence: DOM selectors, menu labels, screenshots-in-words). No guessing — only observed.
- **B. Gap table** — for each Framer capability: `Framer has it | We have it (where) | Missing/misplaced in ours`. Explicitly flag every component capability that currently lives in our Assets page and must MOVE to Components.
- **C. Target spec** — what our self-sufficient Components page must contain to reach parity (create flow, library grid + insert, search, manage actions), and what must be REMOVED from Assets (the whole Components tab) leaving Assets = images/icons/other only.
- **D. Build order** — smallest-slice-first sequence to get there.

Do NOT write code. Do NOT touch Linear (I own Linear writes). Analysis + file + DM path back to @s58-designer. If blocked on browser reach, DM me at once so I feed you the extraction.
