const fs = require("fs");
const data = JSON.parse(fs.readFileSync("FIGMA VARIABLES 14 Feb 26.json", "utf8"));

// Structure: array of { collectionName: { modes: { modeName: variables } } }
function getCollection(name) {
  var item = data.find(c => Object.keys(c)[0] === name);
  if (item) return item[name];
  return null;
}

function toHex(c) {
  if (typeof c !== "object" || c === null || c.r === undefined) return null;
  var r = Math.round(c.r * 255);
  var g = Math.round(c.g * 255);
  var b = Math.round(c.b * 255);
  var hex = "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
  if (c.a !== undefined && c.a < 1) return hex + " (a=" + c.a.toFixed(2) + ")";
  return hex;
}

function flatten(obj, prefix, results) {
  prefix = prefix || "";
  results = results || [];
  for (var k of Object.keys(obj)) {
    var p = prefix ? prefix + "/" + k : k;
    var v = obj[k];
    if (typeof v === "string") {
      results.push({path: p, value: v});
    } else if (typeof v === "object" && v !== null) {
      var hex = toHex(v);
      if (hex) {
        results.push({path: p, value: hex});
      } else {
        flatten(v, p, results);
      }
    } else if (typeof v === "number" || typeof v === "boolean") {
      results.push({path: p, value: String(v)});
    }
  }
  return results;
}

// ============================================================
// 1. ONEMO UI Palette (Dusty) — from _Primitives
// ============================================================
console.log("═══════════════════════════════════════════════════════");
console.log("1. ONEMO UI Palette — _Primitives.Light.Colors");
console.log("═══════════════════════════════════════════════════════");
var prims = getCollection("_Primitives");
var primColors = prims.modes["Light"]["Colors"];
console.log("Colors top keys:", Object.keys(primColors));

// Navigate to ONEMO UI Palette
if (primColors["ONEMO UI Palette"]) {
  var palette = primColors["ONEMO UI Palette"];
  console.log("ONEMO UI Palette keys:", Object.keys(palette));
  var paletteTokens = flatten(palette);
  paletteTokens.forEach(t => console.log("  " + t.path + " → " + t.value));
  console.log("Total ONEMO UI Palette tokens:", paletteTokens.length);
} else {
  console.log("No 'ONEMO UI Palette' key. Available:", Object.keys(primColors));
}

// Also check ICE Palette
console.log("\n");
if (primColors["ICE Palette"]) {
  console.log("═══════════════════════════════════════════════════════");
  console.log("1b. ICE Palette — _Primitives.Light.Colors");
  console.log("═══════════════════════════════════════════════════════");
  var ice = primColors["ICE Palette"];
  console.log("ICE Palette color names:", Object.keys(ice));
  // Print first color fully, then just 500 swatch for the rest
  var iceNames = Object.keys(ice);
  iceNames.forEach((name, i) => {
    var ramp = flatten(ice[name]);
    if (i === 0) {
      console.log("\n  " + name + " (full ramp):");
      ramp.forEach(t => console.log("    " + t.path + " → " + t.value));
    } else {
      var s500 = ramp.find(t => t.path.includes("500"));
      var s25 = ramp.find(t => t.path.includes("25"));
      var s950 = ramp.find(t => t.path.includes("950"));
      console.log("  " + name + ": " + (s25 ? s25.value : "?") + " → " + (s500 ? s500.value : "?") + " → " + (s950 ? s950.value : "?") + " (" + ramp.length + " stops)");
    }
  });
}

// Check Base colors
console.log("\n");
if (primColors["Base"]) {
  console.log("═══════════════════════════════════════════════════════");
  console.log("1c. Base Colors — _Primitives.Light.Colors.Base");
  console.log("═══════════════════════════════════════════════════════");
  var base = flatten(primColors["Base"]);
  base.forEach(t => console.log("  " + t.path + " → " + t.value));
}

// Check Neutral Gray
console.log("\n");
if (primColors["Neutral Gray (light mode)"]) {
  console.log("═══════════════════════════════════════════════════════");
  console.log("1d. Neutral Gray (light mode)");
  console.log("═══════════════════════════════════════════════════════");
  var ng = flatten(primColors["Neutral Gray (light mode)"]);
  ng.forEach(t => console.log("  " + t.path + " → " + t.value));
}

// ============================================================
// 2. ALL Semantic Colors — Light mode
// ============================================================
console.log("\n\n═══════════════════════════════════════════════════════");
console.log("2. Semantic Colors — Light mode (1. Color modes)");
console.log("═══════════════════════════════════════════════════════");
var cm = getCollection("1. Color modes");
var light = cm.modes["Light mode"];
var lightTokens = flatten(light);
lightTokens.forEach((t, i) => console.log((i+1) + ". " + t.path + " → " + t.value));
console.log("\nTotal Light mode tokens: " + lightTokens.length);

// ============================================================
// 3. ALL Semantic Colors — Dark mode
// ============================================================
console.log("\n\n═══════════════════════════════════════════════════════");
console.log("3. Semantic Colors — Dark mode (1. Color modes)");
console.log("═══════════════════════════════════════════════════════");
var dark = cm.modes["Dark mode"];
var darkTokens = flatten(dark);
darkTokens.forEach((t, i) => console.log((i+1) + ". " + t.path + " → " + t.value));
console.log("\nTotal Dark mode tokens: " + darkTokens.length);

// ============================================================
// 4. Alias Color Layer
// ============================================================
console.log("\n\n═══════════════════════════════════════════════════════");
console.log("4. Alias Colors — _Aliases.Style.Colors");
console.log("═══════════════════════════════════════════════════════");
var aliases = getCollection("_Aliases");
console.log("Alias modes:", Object.keys(aliases.modes));
var styleMode = aliases.modes["Style"];
if (styleMode && styleMode["Colors"]) {
  var aliasColors = flatten(styleMode["Colors"]);
  aliasColors.forEach((t, i) => console.log((i+1) + ". " + t.path + " → " + t.value));
  console.log("\nTotal alias color tokens: " + aliasColors.length);
} else {
  console.log("No Colors in Style mode. Keys:", Object.keys(styleMode || {}));
}

// Also check Mode for aliases
var modeAlias = aliases.modes["Mode"];
if (modeAlias) {
  console.log("\n--- Alias 'Mode' colors ---");
  if (modeAlias["Colors"]) {
    var modeColors = flatten(modeAlias["Colors"]);
    modeColors.forEach((t, i) => console.log((i+1) + ". " + t.path + " → " + t.value));
    console.log("Total Mode alias color tokens: " + modeColors.length);
  } else {
    console.log("Mode keys:", Object.keys(modeAlias));
  }
}

// ============================================================
// 5. _Primitives Dark mode colors (if different mode exists)
// ============================================================
console.log("\n\n═══════════════════════════════════════════════════════");
console.log("5. Primitive colors in 'Mode' — _Primitives.Mode.Colors");
console.log("═══════════════════════════════════════════════════════");
var primMode = prims.modes["Mode"];
if (primMode && primMode["Colors"]) {
  var modePrimColors = primMode["Colors"];
  console.log("Mode primitive color top keys:", Object.keys(modePrimColors));
  if (modePrimColors["Neutral Gray (dark mode)"]) {
    var ngDark = flatten(modePrimColors["Neutral Gray (dark mode)"]);
    console.log("\nNeutral Gray (dark mode):");
    ngDark.forEach(t => console.log("  " + t.path + " → " + t.value));
  }
  if (modePrimColors["Neutral Gray (dark mode alpha)"]) {
    var ngDarkA = flatten(modePrimColors["Neutral Gray (dark mode alpha)"]);
    console.log("\nNeutral Gray (dark mode alpha):");
    ngDarkA.forEach(t => console.log("  " + t.path + " → " + t.value));
  }
} else {
  console.log("No Mode.Colors in _Primitives");
}
