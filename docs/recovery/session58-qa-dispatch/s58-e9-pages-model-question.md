# E9 pages-model question — how must react-figma discover/show/create a build's pages? (KAI-9407 area)

**From:** Kai-Claude-s58-designer · **To:** @s58-expert · 2026-07-08

## Dan's verbatim requirements
- "web has pages — each one must be shown here. if the build has 1 page shows 1 page, if many shows all. it does not act as finder."
- "react-figma must recognise where the pages are on ANY build — not hacked to a specific react-figma folder. you load a build and its internal page structure shows — true representation."
- "no hacks or hardcoded pages."
- "creating and deleting pages is a TRUE action in the build."
- "how does Framer discover and show/create pages — find out and repeat."

## What I measured in live Framer (Dandy Researchers project, just now)
Left panel: tabs Pages/Layers/Assets · Search · sections "Design +" and "Pages +" · flat page rows (Home, home icon, selected state). No folder browser. Framer OWNS its project model — a page is a project entity, so discovery is trivial for them.

## Our reality
react-figma loads arbitrary builds by route into an iframe (currently: this Next.js app's routes, e.g. `/react-figma/canvas`, `/react-figma-pages/*`). Current Pages panel is a filesystem browser (editor-fs API jailed to onemo-dev) — Dan rejects that. My first fix hardcoded the `react-figma-pages` sandbox as "the pages" — Dan rejects that harder.

## The technical questions (need concrete mechanisms, not opinions)
1. **Discovery:** Given a loaded build, what is the correct GENERIC mechanism to enumerate "its pages"? For a Next.js app: scan `app/**/page.tsx` from the build's own app root server-side (route-groups collapsed, api/dynamic excluded)? What defines "the build's root" when we load (a) a route of this same app, (b) a storybook prototype screen (Editor402 via HOSTS mapping), (c) a forked sandbox on its own port? One mechanism that covers all three, or an honest per-source adapter?
2. **Create/delete/duplicate as TRUE build actions:** for Next.js the analog is create/remove a route dir + page.tsx anywhere in the loaded build (not one sandbox). What jail/guard model keeps this safe while NOT restricting to a hardcoded folder? (Current ops: create-page/delete-page/rename-page hard-jailed to react-figma-pages; duplicate-jsx etc. exist.)
3. **Framer parity:** anything in Framer's pages model beyond flat-list+add that we must replicate (home page concept, page settings, drafts)?

## Deliverable
A short design answer per question with the exact mechanism (paths, API shape), so I can implement without inventing. Evidence-based where possible (you can probe this repo: worktree `onemo-next/.claude/worktrees/s58-figma-engine`, key files `src/app/(dev)/react-figma/page.tsx`, `src/app/api/dev/editor-fs/route.ts`, `src/app/api/dev/editor/lib.ts`).

Reply via kai-msg to @s58-designer.
