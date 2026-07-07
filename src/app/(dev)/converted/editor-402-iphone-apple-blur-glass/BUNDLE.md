# editor-402-iphone-apple-blur-glass — self-contained conversion bundle

Drop this folder into a product and it renders without external design-system wiring.

## What ships
- `page.tsx` / `editor-402-iphone-apple-blur-glass.tsx` — the component + full structure
- `editor-402-iphone-apple-blur-glass.module.css` — styles (reference only the tokens below)
- `tokens.css` — **54 design tokens** this screen uses, extracted from the DS (light + dark scopes) — the self-containment guarantee
- `theme.css` — dark-mode surface handling
- `fonts.css` + `fonts/` — packaged woff2 (exact weights)
- `assets/` — byte-exact images + inline SVGs

## Integrate
`import Page from './editor-402-iphone-apple-blur-glass/page'` (or copy the folder under your route). Nothing else required.

_All tokens resolved — no external dependency._
