# Asset Library

Non-runtime asset container. Nothing here is served by the app — it's our library of materials, presets, references, and reserved copies that can be deployed to `public/` when needed.

| Folder | Purpose |
|---|---|
| `reserved copies/` | Complete approved setups — full clusters of model + textures + presets ready to deploy |
| `textures/` | Alternative texture sets not currently in use (Poly Haven, ambientCG, procedural) |
| `presets/` | Material configuration presets and code snapshots |
| `screenshots/` | Visual comparison screenshots between versions |
| `images/` | Artwork and image assets not currently deployed |

## How to Use

**To deploy a reserved setup:** Copy the contents of a `reserved copies/` subfolder into the appropriate `public/` paths.

**To try an alternative texture:** Copy from `textures/` into `public/assets/materials/` and update the component imports.
