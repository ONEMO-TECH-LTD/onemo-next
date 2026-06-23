# _3d-editor-eval — archived snapshot

Archived 2026-06-23 17:47 BST from `~/Dev/onemo-dev/_3d-editor-eval` before deleting that 1.5G workspace.
It was the R&D workspace where **ONEMO Studio v2** was prototyped — two open-source 3D editors cloned
and evaluated as a base, with the ONEMO domain layer + golden scene ported in. Productized into
`studio-v2/` (onemo-next, the Mac-app Studio keeper).

## Provenance (stock source re-clones from upstream; only the ONEMO delta is kept here)
- **three.js** → `https://github.com/mrdoob/three.js.git` @ `c20f3ff`
- **thebrowserlab** → `https://github.com/icurtis1/thebrowserlab.git` @ `70840b6`

## Full ONEMO delta at archive time (both clones, excl node_modules/dist/build)
### three.js
```
 M editor/js/Menubar.js
?? assets/
?? editor/js/Menubar.ONEMO.js
?? golden.glb
?? studio.hdr
?? suede-height.png
?? suede-normal.png
?? suede-roughness.jpg
?? test-artwork.png
```
### thebrowserlab
```
?? public/golden.glb
?? public/studio.hdr
?? public/suede-height.png
?? public/suede-normal.png
?? public/suede-roughness.jpg
?? public/test-artwork.png
```
