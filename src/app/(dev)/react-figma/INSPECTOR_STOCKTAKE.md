# React x Figma inspector stocktake

Status: evaluation artifact for `/react-figma`. The first shell-only UI pass is integrated; do not treat this as engine wiring.

## Evidence captured

- Local build screenshot: `/tmp/s58-react-figma-evidence/build-current.png`
- Figma screenshot: `/tmp/s58-react-figma-evidence/figma-current.png`
- Framer inspector screenshot: `/tmp/s58-react-figma-evidence/framer-current.png`
- Framer insert menu screenshot: `/tmp/s58-react-figma-evidence/framer-insert-menu.png`

The local build has the duplicate Framer chrome removed: no duplicate top project bar, no canvas page strip, no canvas bottom dock, no right-side Agent/Style duplicate panel, no left Figma-logo button, and the remaining action is `Publish`, not `Share`.

## What Figma already covers

Figma is the base UI model. Keep its section-based inspector and style any borrowed Framer controls into that language.

- Position: alignment controls, X/Y fields, rotation, flips, and the top-right absolute-position/ignore-auto-layout affordance.
- Auto layout: flow modes `Freeform`, `Vertical`, `Horizontal`, `Grid`; resizing modes `Fixed`, `Hug contents`, `Fill container`; min/max width and height; alignment grid; gap; padding; clip content.
- Appearance and paint: opacity, corner radius, fill, stroke, effects, selection colors, layout guide, export.
- Bottom toolbelt: Move, Frame, Rectangle/Shape, Pen, Text, Comment, Actions, plus mode switches for Draw, Design, Motion, and Dev Mode.
- Variables: value fields need the raw-or-token affordance. Any new CSS/React controls should keep the same variable icon convention.

Figma maps well to visual CSS: position, sizing, flex-like auto layout, paint, radius, opacity, effects, and token variables.

## What Framer adds

Framer's useful parts are not its app chrome. They are web-builder concepts missing from a pure Figma design inspector.

- Insert model: `Elements`, `Icons`, `Shaders`, `Media`, `Forms`, `Interactive`, `Social`, `Utility`, `Creative`, `CMS`, `Collections`, and `Fields`.
- Element toolbar: Insert, Frame/Layout, Text, Vector, Variables.
- Interactions: `Link`, `Link To`, hover/pressed variants, overlays.
- Position and size: X/Y plus width/height modes `Fixed`, `Relative`, `Fill`, `Fit Content`, and `Viewport`, plus min/max.
- Layout: explicit `Stack`/`Grid`, direction, distribute, align, wrap, gap, and padding.
- Runtime styling: cursor, transition/spring, visible yes/no, overflow modes, radius, rotate, border, shadows.
- Web quality gates: accessibility and code overrides.

## Integration recommendation

Keep ONEMO as a Figma-based inspector with web-builder extensions. Do not add duplicate Framer project chrome, top bars, bottom docks, or a second Agent panel.

Add these as Figma-styled sections or subsections:

- `Element`: tag/component picker for `div`, `section`, `button`, `a`, `img`, `input`, `form`, and ONEMO components; include semantic role and component name.
- `Position`: keep Figma alignment and absolute button, then add a compact CSS position row: `auto`, `relative`, `absolute`, `fixed`, `sticky`, plus inset/z-index fields.
- `CSS Layout`: extend Auto layout with Framer's explicit `Stack`/`Grid`, direction, distribute/justify, align, wrap, gap, and padding labels.
- `Size`: expose web sizing modes beside Figma resizing: `fixed`, `relative`, `fill`, `fit-content`, `viewport`, min, and max.
- `Interactions`: link target/route, click, hover, focus, pressed state, overlay, and transition hooks.
- `Web styles`: overflow, cursor, visibility, transition, border, shadows.
- `Accessibility`: role, aria-label, tab index.
- `Code`: generated JSX/CSS preview plus prop/class/override affordances.

Recommended order: finish cleanup verification, add shell-only UI subsections one at a time, then wire values after the shell matches the spec. The current task should stay shell-only unless Dan explicitly asks for live wiring.

## Shell pass integrated

- Added Figma-styled `Element`, `CSS Layout`, `Size`, `Interactions`, `Web styles`, `Accessibility`, and `Code` sections.
- Extended `Position` with CSS position mode and inset/z-index controls while keeping Figma's absolute-position button.
- Left all new values as shell placeholders. Real wiring should come from selected React component props, DOM/CSS computed values, token bindings, and converter state.
