# Studio North Star

This document defines what the ONEMO Studio is for, what it is not for, and what must be true before it can be called production-ready.

Read this before treating any current surface, route, or implementation detail as canonical.

## Core Purpose

The Studio exists so Dan can set up, inspect, and edit scenes visually without needing to write code or ask an agent to manipulate the scene under the hood.

The Studio is the manual visual editor for:

- scene setup
- material setup
- lighting and environment setup
- camera setup
- scene composition and entity adjustment
- save / load / snapshot creation for reusable production-ready scene states

The Studio is not supposed to be a product-shaped one-off tool for a single current prototype.

It must behave like a neutral scene editor.

## Architecture Intent

Two surfaces matter:

1. The **Studio shell**
2. The **R3F / Three viewer runtime**

### PlayCanvas Role

PlayCanvas is used as the **design and interaction shell**.

That means:

- hierarchy
- inspector
- sections
- menus
- toggles
- controls
- editing interaction patterns

PlayCanvas is not the rendering truth.
PlayCanvas is not the capability truth.
PlayCanvas is not the scene-data truth.

It is the shell that exposes the editable surface.

### R3F / Three Role

R3F / Three is the real runtime and the real capability source.

If a thing is configurable in the real viewer code, the Studio should surface it in the UI.

If a thing appears in the Studio UI but the R3F runtime cannot actually do it, that control should be removed, disabled, or explicitly de-scoped.

There should be no fake controls and no pretend wiring.

## Working Rule

The Studio UI must tell Dan the truth about what is actually possible.

That means:

- surface real configurable runtime capabilities
- remove dead or fake controls
- add missing UI where R3F supports a capability but the shell does not expose it yet

The Studio should help Dan understand the actual scope of scene-editing capability without reading code.

## Production Pipeline Intent

The viewer used in the prototype and the future configurator should be the same viewer core.

Studio and prototype must stay connected through a real pipeline.

The Studio should be able to save production-usable outputs such as:

- scenes
- materials
- setup states
- production-ready configuration snapshots

Those outputs must be loadable again by the Studio and consumable by the prototype / future configurator pipeline.

## What Production-Ready Means

The Studio is production-ready only when all of the following are true:

1. It behaves as a neutral visual editor rather than a product-specific hack.
2. Its UI exposes the real configurable R3F / Three capability surface needed for scene setup.
3. Dead, fake, or impossible controls are removed.
4. Dan can manually load, inspect, edit, preview, save, and reload setup states.
5. Saved outputs participate in a real reusable pipeline for prototype / configurator consumption.
6. The system does not depend on agents as the primary way to manipulate scenes.
7. The implementation no longer relies on rendering/runtime paths that contradict the architectural intent.

## Practical Success State

Dan should be able to:

- open the Studio
- load an existing scene or import a new one
- see what parts of the scene are configurable
- change those parts visually
- observe the result in real time through the true viewer runtime
- save the result as a reusable scene/setup snapshot
- reload that snapshot later
- trust that what the UI shows is what the runtime can actually do

If that is not true, the Studio is not done.

## Scope Discipline

When auditing or building:

- ignore stale prototype residues that are not part of the current Studio truth
- do not confuse experimental routes with the canonical pipeline
- compare board claims to code reality
- treat code as source of truth for capability
- treat this document as source of truth for intent and success state

## Final Standard

The Studio should become Dan's visual editor for scene setup.

That is the point.

Not a demo.
Not a placeholder.
Not a hidden agent-driven workflow.

A real visual tool that exposes the real runtime and produces reusable production-ready scene states.
