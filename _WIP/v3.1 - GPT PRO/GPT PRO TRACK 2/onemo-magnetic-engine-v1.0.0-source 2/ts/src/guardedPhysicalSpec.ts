import type { GuardedPhysicalSpec } from "./contracts.js";

/*
 * Physical values only. Arrangement grammar and product ranking do not belong
 * here. The 96 mm entries are phase populations of the same 48 mm lattice;
 * every entry reuses the selected registration origin.
 */
export const GUARDED_PHYSICAL_SPEC: GuardedPhysicalSpec = Object.freeze({
  magnet_radius_mm: "12",
  base_pitch_mm: "48",
  field: Object.freeze({ min_x: -4, max_x: 4, min_y: -4, max_y: 4 }),
  sizes: Object.freeze([
    Object.freeze({ id: "size-72", band: "band-2", max_extent_mm: "72" }),
    Object.freeze({ id: "size-84", band: "band-2", max_extent_mm: "84" }),
    Object.freeze({ id: "size-96", band: "band-2", max_extent_mm: "96" }),
    Object.freeze({ id: "size-108", band: "band-2", max_extent_mm: "108" }),
    Object.freeze({ id: "size-120", band: "band-3", max_extent_mm: "120" }),
    Object.freeze({ id: "size-132", band: "band-3", max_extent_mm: "132" }),
    Object.freeze({ id: "size-144", band: "band-3", max_extent_mm: "144" }),
    Object.freeze({ id: "size-156", band: "band-3", max_extent_mm: "156" }),
  ]),
  registrations: Object.freeze([
    Object.freeze({ id: "r.site-site", origin_mm: Object.freeze(["0", "0"] as const) }),
    Object.freeze({ id: "r.gap-site", origin_mm: Object.freeze(["24", "0"] as const) }),
    Object.freeze({ id: "r.site-gap", origin_mm: Object.freeze(["0", "24"] as const) }),
    Object.freeze({ id: "r.gap-gap", origin_mm: Object.freeze(["24", "24"] as const) }),
  ]),
  populations: Object.freeze([
    Object.freeze({ id: "p48", stride: 1, phase: Object.freeze([0, 0] as const) }),
    Object.freeze({ id: "p96.phase-00", stride: 2, phase: Object.freeze([0, 0] as const) }),
    Object.freeze({ id: "p96.phase-10", stride: 2, phase: Object.freeze([1, 0] as const) }),
    Object.freeze({ id: "p96.phase-01", stride: 2, phase: Object.freeze([0, 1] as const) }),
    Object.freeze({ id: "p96.phase-11", stride: 2, phase: Object.freeze([1, 1] as const) }),
  ]),
});
