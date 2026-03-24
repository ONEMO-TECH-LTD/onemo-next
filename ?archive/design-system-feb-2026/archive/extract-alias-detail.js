const fs = require("fs");
const data = JSON.parse(fs.readFileSync("FIGMA VARIABLES 14 Feb 26.json", "utf8"));

function getCollection(name) {
  var item = data.find(c => Object.keys(c)[0] === name);
  return item ? item[name] : null;
}

// Get alias system colors with proper sub-group names
var aliases = getCollection("_Aliases");
var styleColors = aliases.modes["Style"]["Colors"];

console.log("=== Alias System sub-groups ===");
var system = styleColors["System"];
var systemKeys = Object.keys(system);
console.log("System sub-keys:", systemKeys);

// Each sub-key under System should be Error, Warning, Success, etc.
// But they might be nested differently. Let's explore depth
function showStructure(obj, prefix, depth) {
  prefix = prefix || "";
  depth = depth || 0;
  if (depth > 4) return;
  for (var k of Object.keys(obj)) {
    if (k.startsWith("$")) continue;
    var v = obj[k];
    if (typeof v === "object" && v !== null) {
      console.log("  ".repeat(depth) + prefix + k + " [" + Object.keys(v).filter(x => !x.startsWith("$")).slice(0,5).join(",") + "]");
      showStructure(v, "", depth+1);
    }
  }
}

console.log("\n--- System structure ---");
showStructure(system, "System/");

console.log("\n--- Brand structure ---");
var brand = styleColors["Brand"];
showStructure(brand, "Brand/");

// Now get ONEMO UI Palette "Dusty" sub-color names
console.log("\n\n=== ONEMO UI Palette > Dusty sub-color names ===");
var prims = getCollection("_Primitives");
var uiPalette = prims.modes["Light"]["Colors"]["ONEMO - UI Palette"]["Dusty"];
console.log("Dusty sub-colors:", Object.keys(uiPalette));

// Get just the 500 values for each Dusty sub-color
for (var subColor of Object.keys(uiPalette)) {
  var ramp = uiPalette[subColor];
  if (ramp["500"] && ramp["500"]["$value"]) {
    var v = ramp["500"]["$value"];
    var hex = "";
    if (typeof v === "string") hex = v;
    else if (typeof v === "object" && v.r !== undefined) {
      var r = Math.round(v.r * 255);
      var g = Math.round(v.g * 255);
      var b = Math.round(v.b * 255);
      hex = "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
    }
    console.log("  " + subColor + ".500: " + hex);
  }
}

// Branding Palette sub-colors
console.log("\n\n=== ONEMO Branding Palette sub-colors ===");
var brandPalette = prims.modes["Light"]["Colors"]["ONEMO - Branding Palette"];
for (var family of Object.keys(brandPalette)) {
  console.log("\n" + family + " sub-colors:", Object.keys(brandPalette[family]));
  for (var sub of Object.keys(brandPalette[family])) {
    var ramp = brandPalette[family][sub];
    if (ramp["500"] && ramp["500"]["$value"]) {
      var v = ramp["500"]["$value"];
      var hex = "";
      if (typeof v === "string") hex = v;
      else if (typeof v === "object" && v.r !== undefined) {
        hex = "#" + [Math.round(v.r*255),Math.round(v.g*255),Math.round(v.b*255)].map(x => x.toString(16).padStart(2,"0")).join("");
      }
      console.log("  " + sub + ".500: " + hex);
    }
  }
}
