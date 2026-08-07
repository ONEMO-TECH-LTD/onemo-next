# UI-FX — Jakub Antalik effect libraries (stashed 2026-08-07, Dan directive)

> All MIT, installed as dependencies in THIS repo's package.json (version-locked, ready to wire).
> onemo-next is the prototyping ground — nothing here goes to the clean production repo
> (ONEMO-EFFECTS-ENGINE) until a surface actually adopts it, proven.
> Standing rule from the s62 stability saga: **CSS/canvas-2D anywhere; WebGL never on the same
> page as a live AI session** (the lab's iPhone memory envelope).

| Package | Tech | What it is | Disposition |
|---|---|---|---|
| `thinking-orbs` | canvas-2D, zero-dep, SSR-safe | 9 animated "thinking" orb states, 64/20px sizes, theme-aware, shared clock | **LIVE** in the cutout-lab first-cut loader (`state="shaping"`, commit bc41d623). Reuse for any loading/AI-working state. |
| `border-beam` | pure CSS `@property` + rAF pulse | Traveling/breathing glow border for cards, buttons, inputs | Stashed. Safe anywhere incl. the lab shell. Candidates: active-tool chip highlight, Save/CTA emphasis. Needs Safari 15.4+. |
| `metal-fx` | WebGL, shared context | Liquid-metal ring on buttons/chips + proximity reflection; chromatic/silver/gold | Stashed. **Shop/theme + Figma-shell surfaces only — never the lab page** (WebGL beside the AI session). Candidate: premium product CTAs. |
| `img-fx` | WebGL + Three.js peer | Mosaic "image generation" reveal (`pixels-organic`/`mechanic`, `sweep-gradient`), imperative reveal/hide/regenerate | Stashed. Needs `three` when first wired (repo already has it). Candidates: shop product-card reveals; a lab post-cut reveal only as its own increment with a device gate. |
| transitions.dev | pure CSS snippets (no package) | 18 copy-ready component transitions (`t-*` classes, reduced-motion aware); free + Pro tiers | Not a dependency by design — copy needed snippets into a `transitions.css` beside the shell, attributed. Adopt at the I5 Figma-shell increment; Liquid-portable for the theme. |

Sources: https://github.com/Jakubantalik — demos: orbs.jakubantalik.com · image.jakubantalik.com · transitions.dev repo.
