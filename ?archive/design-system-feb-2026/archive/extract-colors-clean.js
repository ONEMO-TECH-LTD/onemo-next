const fs = require("fs");
const data = JSON.parse(fs.readFileSync("FIGMA VARIABLES 14 Feb 26.json", "utf8"));

function getCollection(name) {
  var item = data.find(c => Object.keys(c)[0] === name);
  if (item) return item[name];
  return null;
}

// Only extract $value fields, skip metadata
function flattenValues(obj, prefix, results) {
  prefix = prefix || "";
  results = results || [];
  for (var k of Object.keys(obj)) {
    // Skip metadata keys
    if (k.startsWith("$") && k !== "$value") continue;

    var p = prefix ? prefix + "/" + k : k;
    var v = obj[k];

    if (k === "$value") {
      // This is the value we want — store with the parent path
      var cleanPath = prefix; // parent path is the token name
      if (typeof v === "string") {
        results.push({path: cleanPath, value: v});
      } else if (typeof v === "object" && v !== null && v.r !== undefined) {
        var r = Math.round(v.r * 255);
        var g = Math.round(v.g * 255);
        var b = Math.round(v.b * 255);
        var hex = "#" + [r,g,b].map(x => x.toString(16).padStart(2,"0")).join("");
        if (v.a !== undefined && v.a < 1) hex += " (a=" + v.a.toFixed(2) + ")";
        results.push({path: cleanPath, value: hex});
      } else {
        results.push({path: cleanPath, value: JSON.stringify(v)});
      }
    } else if (typeof v === "object" && v !== null) {
      flattenValues(v, p, results);
    }
  }
  return results;
}

var output = [];
function log(s) { output.push(s); }

// ============================================================
// 1. Primitive Colors
// ============================================================
var prims = getCollection("_Primitives");
var primLight = prims.modes["Light"]["Colors"];

log("═══════════════════════════════════════════════════════");
log("SECTION 1: PRIMITIVE COLORS (_Primitives.Light.Colors)");
log("═══════════════════════════════════════════════════════");
log("Top-level groups: " + Object.keys(primLight).join(", "));

// Base
log("\n--- Base ---");
flattenValues(primLight["Base"]).forEach(t => log("  " + t.path.replace("Base/","") + ": " + t.value));

// Neutral
log("\n--- Neutral (light mode ramps) ---");
if (primLight["Neutral"]) {
  var neutralGroups = Object.keys(primLight["Neutral"]);
  neutralGroups.forEach(gName => {
    log("\n  " + gName + ":");
    flattenValues(primLight["Neutral"][gName]).forEach(t => {
      var shortPath = t.path.split("/").pop().replace(gName + "/", "");
      if (shortPath === gName) shortPath = t.path.split("/").slice(-1)[0];
      log("    " + t.path.split("/").pop() + ": " + t.value);
    });
  });
}

// ONEMO - UI Palette
log("\n--- ONEMO - UI Palette ---");
if (primLight["ONEMO - UI Palette"]) {
  var uiPalette = primLight["ONEMO - UI Palette"];
  var uiNames = Object.keys(uiPalette);
  log("  Color families: " + uiNames.join(", "));
  uiNames.forEach(name => {
    var tokens = flattenValues(uiPalette[name]);
    if (tokens.length <= 15) {
      log("\n  " + name + ":");
      tokens.forEach(t => log("    " + t.path.split("/").pop() + ": " + t.value));
    } else {
      var s25 = tokens.find(t => t.path.includes("/25"));
      var s500 = tokens.find(t => t.path.includes("/500"));
      var s950 = tokens.find(t => t.path.includes("/950"));
      log("  " + name + ": " + (s25?s25.value:"?") + " → " + (s500?s500.value:"?") + " → " + (s950?s950.value:"?") + " (" + tokens.length + " stops)");
    }
  });
}

// ONEMO - Branding Palette
log("\n--- ONEMO - Branding Palette ---");
if (primLight["ONEMO - Branding Palette"]) {
  var brandPalette = primLight["ONEMO - Branding Palette"];
  var brandNames = Object.keys(brandPalette);
  log("  Color families: " + brandNames.join(", "));
  brandNames.forEach(name => {
    var tokens = flattenValues(brandPalette[name]);
    if (tokens.length <= 15) {
      log("\n  " + name + ":");
      tokens.forEach(t => log("    " + t.path.split("/").pop() + ": " + t.value));
    } else {
      var s25 = tokens.find(t => t.path.includes("/25"));
      var s500 = tokens.find(t => t.path.includes("/500"));
      var s950 = tokens.find(t => t.path.includes("/950"));
      log("  " + name + ": " + (s25?s25.value:"?") + " → " + (s500?s500.value:"?") + " → " + (s950?s950.value:"?") + " (" + tokens.length + " stops)");
    }
  });
}

// Misc Utility
log("\n--- Misc Utility (Untitled UI) ---");
if (primLight["Misc Utility (Untitled UI)"]) {
  var misc = primLight["Misc Utility (Untitled UI)"];
  var miscNames = Object.keys(misc);
  log("  Color families: " + miscNames.join(", "));
  miscNames.forEach(name => {
    var tokens = flattenValues(misc[name]);
    var s500 = tokens.find(t => t.path.includes("/500"));
    log("  " + name + ": " + (s500?s500.value:"(no 500)") + " (" + tokens.length + " stops)");
  });
}

// Dark mode primitives
log("\n--- Primitive Dark Mode Colors ---");
var primDark = prims.modes["Mode"]["Colors"];
if (primDark) {
  log("  Dark mode color groups: " + Object.keys(primDark).join(", "));
  for (var gName of Object.keys(primDark)) {
    var tokens = flattenValues(primDark[gName]);
    if (tokens.length <= 15) {
      log("\n  " + gName + ":");
      tokens.forEach(t => log("    " + t.path.split("/").pop() + ": " + t.value));
    } else {
      log("  " + gName + ": " + tokens.length + " tokens");
    }
  }
}

// ============================================================
// 2. Alias Colors
// ============================================================
log("\n\n═══════════════════════════════════════════════════════");
log("SECTION 2: ALIAS COLORS (_Aliases.Style.Colors)");
log("═══════════════════════════════════════════════════════");
var aliases = getCollection("_Aliases");
var styleColors = aliases.modes["Style"]["Colors"];
if (styleColors) {
  log("Top-level groups: " + Object.keys(styleColors).join(", "));
  for (var group of Object.keys(styleColors)) {
    log("\n--- " + group + " ---");
    var tokens = flattenValues(styleColors[group]);
    tokens.forEach(t => {
      // Clean path to show just the meaningful part
      var parts = t.path.split("/");
      var meaningful = parts.slice(1).join("/"); // skip the group name since we have it as header
      log("  " + (meaningful || parts[0]) + ": " + t.value);
    });
  }
}

// Also Alias Mode
log("\n--- Alias 'Mode' Colors ---");
var modeColors = aliases.modes["Mode"]["Colors"];
if (modeColors) {
  log("Top-level groups: " + Object.keys(modeColors).join(", "));
  for (var group of Object.keys(modeColors)) {
    log("\n  " + group + ":");
    var tokens = flattenValues(modeColors[group]);
    tokens.forEach(t => {
      var parts = t.path.split("/");
      log("    " + parts.slice(1).join("/") + ": " + t.value);
    });
  }
}

// ============================================================
// 3. Semantic Colors — Light mode (values only)
// ============================================================
log("\n\n═══════════════════════════════════════════════════════");
log("SECTION 3: SEMANTIC COLORS — Light mode");
log("═══════════════════════════════════════════════════════");
var cm = getCollection("1. Color modes");
var lightVars = cm.modes["Light mode"];
var lightTokens = flattenValues(lightVars);
var lastGroup = "";
lightTokens.forEach((t, i) => {
  var parts = t.path.split("/");
  var group = parts.slice(0, 2).join("/");
  if (group !== lastGroup) {
    log("\n--- " + group + " ---");
    lastGroup = group;
  }
  var shortName = parts.slice(2).join("/") || parts.slice(1).join("/");
  log("  " + shortName + ": " + t.value);
});
log("\nTotal Light mode semantic tokens: " + lightTokens.length);

// ============================================================
// 4. Semantic Colors — Dark mode (values only)
// ============================================================
log("\n\n═══════════════════════════════════════════════════════");
log("SECTION 4: SEMANTIC COLORS — Dark mode");
log("═══════════════════════════════════════════════════════");
var darkVars = cm.modes["Dark mode"];
var darkTokens = flattenValues(darkVars);
var lastGroup2 = "";
darkTokens.forEach((t, i) => {
  var parts = t.path.split("/");
  var group = parts.slice(0, 2).join("/");
  if (group !== lastGroup2) {
    log("\n--- " + group + " ---");
    lastGroup2 = group;
  }
  var shortName = parts.slice(2).join("/") || parts.slice(1).join("/");
  log("  " + shortName + ": " + t.value);
});
log("\nTotal Dark mode semantic tokens: " + darkTokens.length);

// Write output
fs.writeFileSync("color-extract-clean.txt", output.join("\n"), "utf8");
console.log("Written " + output.length + " lines to color-extract-clean.txt");
