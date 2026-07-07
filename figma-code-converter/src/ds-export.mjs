// VARIABLES_DATA → DS-export JSON (C10.4). The ds-pipeline's build-scan.mjs consumes the format
// Figma's variables EXPORT produces (the manually-exported DS-V2.x JSON). The Desktop Bridge
// payload carries the same information (variables with valuesByMode + collections with modes) —
// this module synthesizes that exact export shape so "edit tokens in Figma → Refresh" regenerates
// tokens.css with no manual export step (Dan's directive).
//
// Format (verified against 11-design-system/figma-var/DS-V2.3.12--1-JULY-2026.json):
//   [ { "<collectionName>": { "modes": { "<modeName>": <nested tree> } } }, … ]
//   leaf: { "$scopes":[...], "$description":"…", "$type":"color|number|string|boolean",
//           "$libraryName":"", "$collectionName":"<target coll>" (aliases only),
//           "$value": "#hex" | number | "string" | "{dot.path}" (alias), "$hiddenFromPublishing":true? }
// Deterministic: same payload → byte-identical JSON (collection order = payload order,
// leaves inserted in variableIds order).

const TYPE = { COLOR: 'color', FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' };

const hex2 = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
const colorHex = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}${c.a != null && c.a < 1 ? hex2(c.a) : ''}`;

/** @param data the bridge VARIABLES_DATA payload ({variables:[…], variableCollections:[…]}) */
export function toDsExport(data) {
  const vars = data.variables ?? [];
  const colls = data.variableCollections ?? [];
  const byId = new Map(vars.map((v) => [v.id, v]));
  const collById = new Map(colls.map((c) => [c.id, c]));

  const leafFor = (v, modeId) => {
    const raw = v.valuesByMode?.[modeId];
    const leaf = {};
    if (v.scopes?.length) leaf.$scopes = v.scopes;
    if (v.description) leaf.$description = v.description;
    leaf.$type = TYPE[v.resolvedType] ?? String(v.resolvedType ?? '').toLowerCase();
    leaf.$libraryName = '';
    if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
      const target = byId.get(raw.id);
      if (target) {
        leaf.$collectionName = collById.get(target.variableCollectionId)?.name ?? '';
        leaf.$value = `{${target.name.split('/').join('.')}}`;
      } else { leaf.$value = `{unresolved:${raw.id}}`; }
    } else if (raw && typeof raw === 'object' && 'r' in raw) leaf.$value = colorHex(raw);
    else leaf.$value = raw;
    if (v.hiddenFromPublishing) leaf.$hiddenFromPublishing = true;
    return leaf;
  };

  return colls.map((coll) => {
    const modes = {};
    for (const mode of coll.modes ?? []) {
      const tree = {};
      for (const vid of coll.variableIds ?? []) {
        const v = byId.get(vid); if (!v) continue;
        const segs = v.name.split('/');
        let node = tree;
        for (const s of segs.slice(0, -1)) node = (node[s] ??= {});
        node[segs.at(-1)] = leafFor(v, mode.modeId);
      }
      modes[mode.name] = tree;
    }
    return { [coll.name]: { modes } };
  });
}

/** converter dump (ID→name map) from the same payload — one source, two artifacts. */
export function toVariableDump(data, fileKey, fileVersion) {
  const collById = new Map((data.variableCollections ?? []).map((c) => [c.id, c.name]));
  return {
    fileKey, fileVersion, dumpedWith: 'studio-bridge-peer',
    variables: Object.fromEntries((data.variables ?? []).map((v) => [v.id, { name: v.name, collection: collById.get(v.variableCollectionId) ?? '' }])),
  };
}
