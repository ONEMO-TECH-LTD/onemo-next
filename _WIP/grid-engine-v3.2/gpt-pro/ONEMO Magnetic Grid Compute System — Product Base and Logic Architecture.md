# ONEMO Magnetic Grid Compute System  
## Product Base and Logic Architecture

**Status:** Foundation specification for the later mathematical implementation.  
**Scope:** One validated simple closed outer silhouette, measured in millimetres.

---

# Part A — Technical Requirements and Product Specification

## 1. System objective

Given one freeform cutout silhouette, compute:

- lawful proportional product sizes;
- the cutout’s usable magnetic regions;
- its registration against the ONEMO grid;
- lawful magnet-node patterns;
- the mechanically preferred arrangement;
- exact manufacturing dimensions and magnet coordinates.

The system does not trace images or alter the supplied silhouette.

---

## 2. Locked physical constants

| Property | Requirement |
|---|---:|
| Base cell | 24 × 24 mm |
| Required safe disc | 24 mm diameter |
| Safe radius from magnet centre | 12 mm |
| Magnet-node pitch | 48 mm |
| Scale increment | 12 mm |
| Units | Millimetres |

The actual magnet may be 6, 8 or 10 mm, but every magnet centre receives the same 24 mm protected material area.

A candidate is legal only when the complete closed 24 mm disc is contained inside the cutout. Boundary tangency is legal.

---

## 3. Universal grid

The grid is an unlimited board of addressable 24 mm square cells.

Each cell has:

- integer coordinate `(column, row)`;
- human-readable address;
- exact centre coordinate in millimetres;
- cell type;
- cutout occupancy state;
- selection state.

Magnet-capable cells occur every second cell on each axis, creating the fixed 48 mm node lattice.

Other cells remain part of the coordinate and measurement system even when they contain no magnet.

The mathematical grid is unlimited. A 10 × 10 or similar board is only a UI window.

---

## 4. Band and axis model

Each bounding-box axis is classified independently.

| Axis class | Dimension range | Magnet lines possible on a fully filled axis | Minimum reference span |
|---|---:|---:|---:|
| 1 | 24 ≤ side < 72 | 1 | 24 mm |
| 2 | 72 ≤ side < 120 | 2 | 72 mm |
| 3 | 120 ≤ side < 168 | 3 | 120 mm |
| 4 | 168 ≤ side < 216 | 4 | 168 mm |
| 5 | 216 ≤ side ≤ 264 | 5 | 216 mm |

Overall product band:

- **B1:** dominant axis class 1
- **B2:** dominant axis class 2
- **B3:** dominant axis class 3
- **B4:** dominant axis class 4
- **B5:** dominant axis class 5

The overall band is the larger of the two axis classes.

Examples:

- `1 × 2` axis classes: tall B2
- `2 × 1`: wide B2
- `2 × 2`: square-like B2
- `2 × 3`: rectangular B3
- `3 × 3`: square-like B3

Band assignment is based on the outer bounding box. Magnet legality is based on the actual silhouette.

---

## 5. Canonical node frame

A frame containing `n` magnet lines on an axis spans `2n − 1` base cells.

Examples:

| Node frame | Cell frame |
|---|---|
| 1 × 1 | 1 × 1 cells |
| 1 × 2 | 1 × 3 cells |
| 2 × 2 | 3 × 3 cells |
| 2 × 3 | 3 × 5 cells |
| 3 × 3 | 5 × 5 cells |
| 4 × 4 | 7 × 7 cells |
| 5 × 5 | 9 × 9 cells |

A frame describes candidate grid structure. It does not require every node to be populated.

---

## 6. Canonical registration

Registration defines the translation between the scaled cutout and the fixed grid.

The canonical frame centre is aligned with the cutout bounding-box centre.

Per axis:

- odd magnet-line count: the centre axis passes through a magnet-node line;
- even magnet-line count: the centre axis passes through the middle spacer-cell line.

Examples:

- B1 `1 × 1`: bbox centre aligns with one magnet node;
- tall B2 `1 × 2`: bbox centre aligns with the midpoint between the vertical pair;
- wide B2 `2 × 1`: bbox centre aligns with the midpoint between the horizontal pair;
- square B2 `2 × 2`: bbox centre aligns with the central empty 24 mm cell;
- square B3 `3 × 3`: bbox centre aligns with the central magnet node.

Canonical registration is the first test, not automatically the final placement.

A controlled translation search may be performed within one repeating 48 × 48 mm grid period. Rotation is prohibited.

The exact translation-search resolution remains a configurable policy parameter.

---

## 7. Shape representations

The system must preserve three separate representations.

### 7.1 Outer silhouette

The exact manufactured cut line.

Used for:

- bounding box;
- scale;
- material area;
- centroid;
- connectivity;
- final manufacturing output.

### 7.2 Safe core

The outer silhouette eroded by a closed 12 mm-radius disc.

The safe core is the complete set of lawful magnet-centre locations.

It must be computed from exact boundary distance or equivalent exact disc erosion.

It must not be produced by:

- bounding-box approximation;
- raster sampling;
- visual offset-path joins;
- vertex-only distance checks.

An irregular edge entering any part of the required disc invalidates that centre.

### 7.3 Structural support graph

A geometric abstraction derived from the outer silhouette and safe core.

It contains:

- major safe regions;
- marginal safe regions;
- terminal branches;
- material corridors connecting regions;
- region area;
- centroid;
- local clearance;
- local width;
- vertical position;
- persistence across nearby sizes.

The structural graph may classify a region as compact, horizontal, vertical or branch-like, but final legality must always use the exact silhouette.

---

## 8. Noise and useful-area rules

A safe-core point being legal does not automatically make it useful.

The system must distinguish:

### Strong support region

A region that is:

- substantial in area;
- locally wide;
- persistent across nearby sizes;
- connected to meaningful material mass;
- capable of supporting a coherent grid pattern.

### Marginal region

A region that is:

- a very small terminal branch;
- a temporary fit at one narrow scale;
- close to the minimum clearance;
- associated with little surrounding material;
- created by a tip, limb or local curve.

Examples such as ear tips, narrow limbs and shoulder tails are not semantically excluded. They are excluded only when their geometry is weak at the evaluated size.

A narrow connector may be unable to host a magnet while still remaining mechanically important as a connection between larger masses.

---

## 9. Grid-node classification

For every evaluated registration, each magnet node receives one state:

- **Illegal:** node centre is outside the safe core.
- **Marginal:** legal but located in weak structural geometry.
- **Strong:** legal and located in a significant support region.
- **Selected:** included in the final arrangement.

Every node retains:

- board address;
- local cutout coordinates;
- manufacturing coordinates;
- edge clearance;
- structural-region identifier.

---

## 10. Approved pattern model

The system uses a versioned library of approved node templates.

Initial pattern families include:

- single;
- vertical pair;
- horizontal pair;
- L;
- horizontal row;
- vertical column;
- T;
- rectangular four-node arrangement;
- approved larger extensions.

Patterns are expressed as relative magnet-node coordinates on the 48 mm lattice.

The engine may instantiate approved templates from legal nodes. It must not create arbitrary subsets solely to increase magnet count.

---

## 11. Mechanical selection priorities

Selection is lexicographic, not based on one opaque score.

Apply rules in this order:

1. **Full geometric legality**
2. **Coverage of major support regions**
3. **Support of the upper gravity-critical mass**
4. **Reduction of unsupported material extent**
5. **Reduction of peel or flap leverage**
6. **Coherent approved pattern**
7. **Distribution across distinct material masses**
8. **Geometric and visual balance**
9. **Lower magnet count when support is equivalent**

More magnets do not automatically produce a better result.

The geometric centroid is evidence, not the placement rule.

---

## 12. Scale rules

For each candidate size:

- preserve the original aspect ratio;
- scale the complete silhouette uniformly;
- use the dominant bounding-box side as the size-band reference;
- recompute the safe core;
- recompute structural regions;
- recompute registration and node legality;
- evaluate the size independently.

No result may be inferred from a smaller or larger size without evaluation.

---

## 13. Hard exclusions

The system must never:

- use the rectangular source image as material;
- treat empty bounding-box space as cutout material;
- permit partial safe-disc containment;
- move magnets off the fixed grid;
- deform the silhouette;
- independently scale regions;
- rotate or mirror the silhouette;
- permanently discard a feature at every size;
- select a layout only because it contains more magnets;
- replace exact legality with primitive inner boxes or circles.

---

# Part B — Logic Architecture

## 14. Compute-module structure

The compute module contains two cooperating engines.

```text
┌─────────────────────────────────────┐
│ ONEMO Magnetic Compute Module       │
│                                     │
│  ┌──────────────┐   requests        │
│  │ Logic Engine │ ───────────────┐  │
│  └──────────────┘                │  │
│          ▲                       ▼  │
│          │ evidence      ┌────────┐ │
│          └─────────────── │ Math   │ │
│                           │ Engine │ │
│                           └────────┘ │
└─────────────────────────────────────┘
```

### Logic Engine owns

- what must be evaluated;
- band and axis classification;
- frame hypothesis;
- canonical registration rule;
- allowed registration search;
- approved pattern library;
- structural thresholds;
- mechanical priorities;
- final acceptance and selection.

### Math Engine owns

- exact geometry;
- scaling;
- bounding boxes;
- safe-core computation;
- distance and clearance;
- grid-coordinate conversion;
- registration transforms;
- eligible-node detection;
- structural measurements;
- pattern instantiation;
- support metrics.

The Math Engine returns evidence. It does not choose product policy.

The Logic Engine chooses policy. It does not approximate geometry.

---

## 15. Input contract

The compute module receives:

| Input | Requirement |
|---|---|
| `outline` | One validated simple closed polygon |
| `units` | Millimetres |
| `top_direction` | Required for gravity evaluation |
| `size_domain` | Permitted physical size range |
| `size_step` | Default 12 mm |
| `grid_profile` | 24 mm cells / 48 mm nodes |
| `safety_profile` | 12 mm radius |
| `pattern_policy_version` | Approved template set |
| `selection_policy_version` | Mechanical rule set |

Initial scope excludes holes and disconnected silhouettes.

---

## 16. Logic-to-math evaluation plan

For each candidate size, the Logic Engine sends:

```text
EvaluationPlan
├── target_size
├── uniform_scale
├── axis_class_x
├── axis_class_y
├── canonical_node_frame
├── canonical_registration_anchor
├── permitted_translation_domain
├── permitted_pattern_templates
├── structural_thresholds
├── gravity_direction
└── required_metrics
```

The plan specifies what the Math Engine must test. It does not contain assumed geometric answers.

---

## 17. Math evidence response

The Math Engine returns:

```text
GeometryEvidence
├── scaled_outer_silhouette
├── bounding_box
├── safe_core
├── safe_core_components
├── structural_measurements
├── registration_offset
├── legal_grid_nodes
├── node_clearances
├── node_region_assignments
├── instantiated_patterns
├── supported_material_metrics
├── unsupported_extent_metrics
├── gravity_metrics
└── exact failure reasons
```

All returned coordinates must be available both as:

- board-cell/node addresses;
- exact cutout-relative millimetre coordinates.

---

## 18. Logic execution sequence

```text
1. Validate input
2. Generate proportional candidate sizes
3. Classify X and Y axes
4. Assign overall band
5. Build canonical node-frame hypothesis
6. Request canonical registration evaluation
7. Receive safe core and structural evidence
8. Classify strong, marginal and illegal nodes
9. Instantiate approved patterns
10. Apply mechanical selection priorities
11. If required, request controlled registration alternatives
12. Select or reject the size
13. Repeat for every candidate size
14. Assemble manufacturing output
```

The Logic Engine may issue repeated Math Engine requests for the same size when testing alternative registrations or approved pattern hypotheses.

---

## 19. Final output contract

For every accepted size, return:

```text
ManufacturingSolution
├── band
├── exact_width_mm
├── exact_height_mm
├── scale_factor
├── axis_class_x
├── axis_class_y
├── node_frame
├── registration_offset_mm
├── selected_pattern_id
├── selected_node_addresses
├── magnet_centres_mm
├── minimum_edge_clearance_mm
├── supported_structural_regions
├── unsupported_extent_metrics
├── gravity_support_result
├── validation_status
└── deterministic decision reasons
```

For rejected sizes, return machine-readable rejection reasons such as:

- safe core empty;
- no strong grid node;
- no approved lawful pattern;
- upper critical mass unsupported;
- excessive unsupported extent;
- registration search exhausted.

---

## 20. Architecture principle

> **Logic specifies what must be tested and what constitutes a good product result. Math proves what is geometrically true. The final manufacturing solution is selected only from mathematically lawful evidence under the versioned product rules.**

---

## 21. Items still requiring a later mathematical decision

1. Registration search: continuous translation or fixed resolution.
2. Exact thresholds separating strong and marginal structural regions.
3. Numerical definition of unsupported extent and peel leverage.
4. Final approved pattern library and its band-specific permissions.
5. Tie-breaking thresholds for mechanically equivalent arrangements.