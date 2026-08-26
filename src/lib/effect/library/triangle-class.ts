import { CLASS_SPECS } from './registry-class'
import type { LibraryClass } from './class-contract'

// Triangle policy remains in its dedicated geometry support modules. STEP 2 exposes it through
// the same class-package seam as fixed-frame classes; STEP 3 replaces the legacy outline body.
export const triangleClass = CLASS_SPECS.triangle as unknown as LibraryClass
