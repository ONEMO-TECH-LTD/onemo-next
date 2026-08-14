import { writeFileSync } from "node:fs";
import { canonicalJson } from "../dist/src/canonicalJson.js";
import { GUARDED_PHYSICAL_SPEC } from "../dist/src/guardedPhysicalSpec.js";
import { INITIAL_GRAMMAR_V1 } from "../dist/src/initialGrammar.js";

const request = {
  schema: "onemo.magnetic.solve.request/1",
  outline: [
    ["-100", "-60"],
    ["-30", "-60"],
    ["-12", "-20"],
    ["0", "-45"],
    ["12", "-20"],
    ["30", "-60"],
    ["100", "-60"],
    ["75", "-10"],
    ["100", "60"],
    ["30", "60"],
    ["12", "20"],
    ["0", "45"],
    ["-12", "20"],
    ["-30", "60"],
    ["-100", "60"],
    ["-75", "10"],
  ],
  scale_basis: "max_bbox_extent",
  magnet_radius_mm: GUARDED_PHYSICAL_SPEC.magnet_radius_mm,
  base_pitch_mm: GUARDED_PHYSICAL_SPEC.base_pitch_mm,
  field: GUARDED_PHYSICAL_SPEC.field,
  sizes: GUARDED_PHYSICAL_SPEC.sizes,
  registrations: GUARDED_PHYSICAL_SPEC.registrations,
  populations: GUARDED_PHYSICAL_SPEC.populations,
  patterns: INITIAL_GRAMMAR_V1,
};

const output = new URL("../../fixtures/benchmark_request.json", import.meta.url);
writeFileSync(output, `${canonicalJson(request)}\n`, "utf8");
