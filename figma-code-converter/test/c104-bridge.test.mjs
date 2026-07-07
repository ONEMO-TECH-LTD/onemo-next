// C10.4 — headless bridge peer + DS-export synthesis (Dan: refresh pulls screens AND the token
// system from Figma; no manual variables-JSON export ever).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDsExport, toVariableDump } from '../src/ds-export.mjs';

const PAYLOAD = { // shape exactly as the Desktop Bridge plugin pushes (VARIABLES_DATA.data)
  success: true, fileKey: 'KEY',
  variables: [
    { id: 'VariableID:1:1', name: 'base/white', resolvedType: 'COLOR', variableCollectionId: 'C1',
      valuesByMode: { 'M1': { r: 1, g: 1, b: 1, a: 1 }, 'M2': { r: 0, g: 0, b: 0, a: 1 } },
      scopes: ['ALL_SCOPES'], description: '', hiddenFromPublishing: true },
    { id: 'VariableID:1:2', name: 'text/primary', resolvedType: 'COLOR', variableCollectionId: 'C2',
      valuesByMode: { 'M3': { type: 'VARIABLE_ALIAS', id: 'VariableID:1:1' } },
      scopes: ['TEXT_FILL'], description: 'Primary text.' },
    { id: 'VariableID:1:3', name: 'standard/m', resolvedType: 'FLOAT', variableCollectionId: 'C2',
      valuesByMode: { 'M3': 16 }, scopes: [] },
  ],
  variableCollections: [
    { id: 'C1', name: '.1.0-Prim-Col', modes: [{ modeId: 'M1', name: 'Light' }, { modeId: 'M2', name: 'Dark' }], variableIds: ['VariableID:1:1'] },
    { id: 'C2', name: '3.0-Sem-Col', modes: [{ modeId: 'M3', name: 'Value' }], variableIds: ['VariableID:1:2', 'VariableID:1:3'] },
  ],
};

test('toDsExport matches the Figma variables-export format build-scan consumes', () => {
  const out = toDsExport(PAYLOAD);
  // [ {collectionName:{modes:{modeName:tree}}} ] — verified against DS-V2.3.12 export
  assert.equal(out.length, 2);
  const prim = out[0]['.1.0-Prim-Col'];
  assert.deepEqual(Object.keys(prim.modes), ['Light', 'Dark']);
  assert.deepEqual(prim.modes.Light.base.white, { $scopes: ['ALL_SCOPES'], $type: 'color', $libraryName: '', $value: '#ffffff', $hiddenFromPublishing: true });
  assert.equal(prim.modes.Dark.base.white.$value, '#000000');
  const sem = out[1]['3.0-Sem-Col'].modes.Value;
  // alias → "{dot.path}" + $collectionName (the export's alias syntax, exactly)
  assert.equal(sem.text.primary.$value, '{base.white}');
  assert.equal(sem.text.primary.$collectionName, '.1.0-Prim-Col');
  assert.equal(sem.text.primary.$description, 'Primary text.');
  assert.deepEqual(sem.standard.m, { $type: 'float', $libraryName: '', $value: 16 }); // 'float' is what Figma's export writes (not DTCG 'number') — build-scan keys on it
});

test('toDsExport is deterministic (same payload → byte-identical JSON)', () => {
  assert.equal(JSON.stringify(toDsExport(PAYLOAD)), JSON.stringify(toDsExport(PAYLOAD)));
});

test('toVariableDump produces the converter dump (ID→name+collection, version-stamped)', () => {
  const d = toVariableDump(PAYLOAD, 'KEY', 'V42');
  assert.equal(d.fileVersion, 'V42');
  assert.equal(d.dumpedWith, 'studio-bridge-peer');
  assert.deepEqual(d.variables['VariableID:1:2'], { name: 'text/primary', collection: '3.0-Sem-Col' });
});
