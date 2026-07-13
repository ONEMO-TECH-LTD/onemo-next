import { buildCanonicalModel } from '../src/canonical-model.mjs';

const alias = (id) => ({ type: 'VARIABLE_ALIAS', id });
const planes = Object.fromEntries(['document', 'supplement', 'variables', 'components', 'fonts', 'assets', 'dependencies'].map((key) => [key, 'fixture']));

export function p3Fixture({ colorName = 'Velvet / Ink', colorWeb = '--velvet-ink', darkColor = { r: 0.9, g: 0.8, b: 0.7, a: 1 }, componentVariable = 'V_BOOL', componentName = 'Choice' } = {}) {
  const document = {
    id: 'root', type: 'FRAME', name: 'Arbitrary editorial screen', size: { x: 85, y: 180 }, opacity: 0.85,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, boundVariables: { color: alias('V_COLOR') } }],
    boundVariables: { size: { x: alias('V_FLOAT') }, opacity: alias('V_FLOAT') },
    children: [
      { id: 'set', type: 'COMPONENT_SET', name: 'Choice', children: [] },
      {
        id: 'instance', type: 'INSTANCE', name: 'Choice instance',
        componentProperties: { Enabled: { type: 'BOOLEAN', value: true, boundVariables: { value: alias(componentVariable) } } },
        children: [{ id: 'instance-control', type: 'RECTANGLE', name: 'Visible layer', visible: true, children: [] }],
      },
      { id: 'text', type: 'TEXT', name: 'Editorial copy', characters: 'Look', boundVariables: { characters: alias('V_COPY') }, children: [] },
      {
        id: 'nested', type: 'FRAME', name: 'Nested override',
        fills: [{ type: 'SOLID', color: darkColor, boundVariables: { color: alias('V_ALIAS') } }],
        children: [],
      },
    ],
  };
  const components = {
    componentSets: [{
      id: 'set', key: 'SET_CHOICE', name: componentName, complete: true,
      propertyDefinitions: {
        Size: { type: 'VARIANT', defaultValue: 'S', variantOptions: ['S', 'L'] },
        Enabled: { type: 'BOOLEAN', defaultValue: false },
      },
    }],
    components: [
      {
        id: 'choice-s', key: 'CMP_CHOICE_S', name: `${componentName}/S`, componentSetKey: 'SET_CHOICE', complete: true,
        variantProperties: { Size: 'S' }, propertyDefinitions: { Enabled: { type: 'BOOLEAN', defaultValue: false } },
      },
      {
        id: 'choice-l', key: 'CMP_CHOICE_L', name: `${componentName}/L`, componentSetKey: 'SET_CHOICE', complete: true,
        variantProperties: { Size: 'L' }, propertyDefinitions: { Enabled: { type: 'BOOLEAN', defaultValue: false } },
      },
    ],
  };
  const fontDependencies = [{ family: 'Inter', style: 'Regular', providerId: 'font-inter-regular', sha256: '1'.repeat(64) }];
  const supplement = { schemaVersion: 1, nodes: [
    { nodeId: 'root', resolvedVariableModes: { C_THEME: 'light' } },
    { nodeId: 'set', resolvedVariableModes: {}, componentPropertyDefinitions: components.componentSets[0].propertyDefinitions },
    {
      nodeId: 'instance', resolvedVariableModes: { C_THEME: 'light' }, mainComponentKey: 'CMP_CHOICE_S',
      componentProperties: { Size: { type: 'VARIANT', value: 'S' }, Enabled: { type: 'BOOLEAN', value: true } },
      overrides: [{ id: 'instance-control', overriddenFields: ['visible'] }],
    },
    { nodeId: 'instance-control', resolvedVariableModes: { C_THEME: 'light' }, componentPropertyReferences: { visible: 'Enabled' } },
    {
      nodeId: 'text', resolvedVariableModes: { C_THEME: 'light' },
      styledTextSegments: [
        { start: 0, end: 2, characters: 'Lo', fontName: { family: 'Inter', style: 'Regular' } },
        { start: 2, end: 4, characters: 'ok', fontName: { family: 'Inter', style: 'Regular' }, hyperlink: { type: 'URL', value: 'https://example.test/look' } },
      ],
      fontDependencies,
    },
    { nodeId: 'nested', resolvedVariableModes: { C_THEME: 'dark', C_ALIAS: 'base' } },
  ] };
  const variables = {
    variableCollections: [
      {
        id: 'C_THEME', key: 'CK_THEME', name: 'Arbitrary modes', defaultModeId: 'light',
        modes: [{ modeId: 'light', name: 'Light' }, { modeId: 'dark', name: 'Dark' }],
      },
      { id: 'C_ALIAS', key: 'CK_ALIAS', name: 'Alias source', defaultModeId: 'base', modes: [{ modeId: 'base', name: 'Base' }] },
    ],
    variables: [
      { id: 'V_COLOR', key: 'K_COLOR', name: colorName, codeSyntax: colorWeb === null ? {} : { WEB: colorWeb }, variableCollectionId: 'C_THEME', resolvedType: 'COLOR', valuesByMode: { light: { r: 0.1, g: 0.15, b: 0.2, a: 1 }, dark: darkColor } },
      { id: 'V_FLOAT', key: 'K_FLOAT', name: 'Loose measure', codeSyntax: {}, variableCollectionId: 'C_THEME', resolvedType: 'FLOAT', valuesByMode: { light: 85, dark: 72 } },
      { id: 'V_COPY', key: 'K_COPY', name: 'Editorial copy', codeSyntax: {}, variableCollectionId: 'C_THEME', resolvedType: 'STRING', valuesByMode: { light: 'Look', dark: 'Night' } },
      { id: 'V_BOOL', key: 'K_BOOL', name: 'Choice enabled', codeSyntax: {}, variableCollectionId: 'C_THEME', resolvedType: 'BOOLEAN', valuesByMode: { light: true, dark: false } },
      { id: 'V_ALIAS', key: 'K_ALIAS', name: 'Nested ink alias', codeSyntax: {}, variableCollectionId: 'C_ALIAS', resolvedType: 'COLOR', valuesByMode: { base: alias('V_COLOR') } },
    ],
  };
  const snapshot = {
    manifest: { sourcePlanes: planes, files: {} }, document, components, supplement, variables,
    fonts: {},
    dependencies: { assets: [], assetNodeIds: [] },
  };
  return { snapshot, model: buildCanonicalModel({ snapshot, evidenceClass: 'microfixture', fileKey: 'P3_FIXTURE' }) };
}
