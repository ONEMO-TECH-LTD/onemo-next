/** Native-identity P2 ComponentGraph (§5.4); incomplete definitions/instances fail closed. */
import { SCHEMA } from './schema.mjs';
import { graphSourcePlaneErrors } from './provenance.mjs';
import { canonicalJson } from './evidence.mjs';

export class ComponentGraphError extends Error {
  constructor(state, message) { super(message); this.state = state; }
}

export function buildComponentGraph({ document, components, supplement, sourcePlanes, evidenceClass }) {
  const planeErrors = graphSourcePlaneErrors({ sourcePlanes, evidenceClass, families: ['document', 'components', 'supplement'] });
  if (planeErrors.length) throw new ComponentGraphError('FAILED_CAPTURE', `ComponentGraph provenance: ${planeErrors.join(', ')}`);
  if (!Array.isArray(components?.components) || !Array.isArray(components?.componentSets) || !Array.isArray(supplement?.nodes)) {
    throw new ComponentGraphError('FAILED_CAPTURE', 'complete components and supplement arrays required');
  }
  const definitions = [...components.componentSets, ...components.components].map((row) => ({
    ...structuredClone(row),
    propertyDefinitions: structuredClone(row?.propertyDefinitions ?? {}),
  }));
  const byKey = new Map();
  const byId = new Map();
  for (const row of definitions) {
    if (!row?.key || !row.id || row.complete !== true) throw new ComponentGraphError('FAILED_COMPONENT', `component definition ${row?.id ?? '?'} is incomplete or has no stable key`);
    if (byKey.has(row.key)) throw new ComponentGraphError('FAILED_COMPONENT', `duplicate component stable key ${row.key}`);
    validatePropertyDefinitions(row.key, row.propertyDefinitions ?? {});
    byKey.set(row.key, row);
    byId.set(row.id, row);
  }
  for (const row of components.components) {
    if (row.componentSetKey && !byKey.has(row.componentSetKey)) throw new ComponentGraphError('FAILED_COMPONENT', `component ${row.key} references unreadable set ${row.componentSetKey}`);
  }
  const nodeTypes = new Map();
  const parentById = new Map();
  (function walk(node, parentId = null) { if (!node) return; nodeTypes.set(node.id, node.type); parentById.set(node.id, parentId); (node.children ?? []).forEach((child) => walk(child, node.id)); })(document);
  const supplementByNode = new Map(supplement.nodes.map((row) => [row.nodeId, row]));
  const definitionSupplements = [];
  const propertyReferences = [];
  const instances = [];
  for (const row of supplement.nodes) {
    if (row.componentPropertyDefinitions !== undefined) {
      if (!['COMPONENT', 'COMPONENT_SET'].includes(nodeTypes.get(row.nodeId))) throw new ComponentGraphError('FAILED_COMPONENT', `definition supplement ${row.nodeId} has no native component owner`);
      const catalog = byId.get(row.nodeId);
      if (!catalog || canonicalJson(catalog.propertyDefinitions ?? {}) !== canonicalJson(row.componentPropertyDefinitions)) {
        throw new ComponentGraphError('FAILED_COMPONENT', `definition supplement ${row.nodeId} disagrees with captured catalog`);
      }
      definitionSupplements.push({ nodeId: row.nodeId, componentPropertyDefinitions: structuredClone(row.componentPropertyDefinitions) });
    }
    if (row.componentPropertyReferences !== undefined && row.componentPropertyReferences !== null) {
      const owner = componentOwner(row.nodeId, parentById, nodeTypes, supplementByNode, byId, byKey);
      if (!owner) throw new ComponentGraphError('FAILED_COMPONENT', `component property references on ${row.nodeId} have no containing component/main component`);
      validateComponentReferenceMap(row.nodeId, nodeTypes.get(row.nodeId), row.componentPropertyReferences, owner);
      propertyReferences.push({ nodeId: row.nodeId, ownerComponentKey: owner.key, references: structuredClone(row.componentPropertyReferences) });
    }
    if (!row.mainComponentKey) continue;
    if (nodeTypes.get(row.nodeId) !== 'INSTANCE') throw new ComponentGraphError('FAILED_COMPONENT', `component instance supplement ${row.nodeId} has no INSTANCE node`);
    if (!byKey.has(row.mainComponentKey)) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${row.nodeId} references unreadable component ${row.mainComponentKey}`);
    validateInstanceProperties(row, byKey);
    validateOverrideRecords(row.nodeId, row.overrides ?? [], parentById);
    instances.push({
      nodeId: row.nodeId,
      mainComponentKey: row.mainComponentKey,
      componentProperties: structuredClone(row.componentProperties ?? {}),
      componentPropertyReferences: structuredClone(row.componentPropertyReferences ?? null),
      overrides: structuredClone(row.overrides ?? []),
    });
  }
  for (const [nodeId, type] of nodeTypes) if (type === 'INSTANCE' && !instances.some((row) => row.nodeId === nodeId)) {
    throw new ComponentGraphError('FAILED_COMPONENT', `instance ${nodeId} lacks complete plugin semantics`);
  }
  return { schemaVersion: SCHEMA.componentGraph, definitions, definitionSupplements, propertyReferences, instances };
}

const PROPERTY_TYPES = new Set(['BOOLEAN', 'TEXT', 'INSTANCE_SWAP', 'VARIANT']);

function validatePropertyDefinitions(owner, definitions) {
  if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) throw new ComponentGraphError('FAILED_COMPONENT', `component ${owner} property definitions invalid`);
  for (const [name, definition] of Object.entries(definitions)) {
    if (!PROPERTY_TYPES.has(definition?.type) || !Object.hasOwn(definition, 'defaultValue')) throw new ComponentGraphError('FAILED_COMPONENT', `component ${owner} property ${name} type/default invalid`);
    if (definition.type === 'VARIANT' && (!Array.isArray(definition.variantOptions) || !definition.variantOptions.includes(definition.defaultValue))) {
      throw new ComponentGraphError('FAILED_COMPONENT', `component ${owner} variant ${name} has invalid options/default`);
    }
  }
}

function validateInstanceProperties(instance, byKey) {
  const component = byKey.get(instance.mainComponentKey);
  const parent = component.componentSetKey ? byKey.get(component.componentSetKey) : null;
  const definitions = { ...(parent?.propertyDefinitions ?? {}), ...(component.propertyDefinitions ?? {}) };
  for (const [name, property] of Object.entries(instance.componentProperties ?? {})) {
    const definition = definitions[name];
    if (!definition || property?.type !== definition.type || !Object.hasOwn(property, 'value')) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instance.nodeId} property ${name} is not in its complete typed API`);
    if (definition.type === 'VARIANT' && !definition.variantOptions.includes(property.value)) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instance.nodeId} variant ${name} value ${property.value} is not legal`);
    if (definition.type === 'BOOLEAN' && typeof property.value !== 'boolean') throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instance.nodeId} boolean ${name} is not boolean`);
    if (definition.type === 'TEXT' && typeof property.value !== 'string') throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instance.nodeId} text ${name} is not text`);
  }
}

const REFERENCE_FIELDS = Object.freeze({ visible: 'BOOLEAN', characters: 'TEXT', mainComponent: 'INSTANCE_SWAP' });

export function validateComponentReferenceMap(nodeId, nodeType, references, owner) {
  if (!references || typeof references !== 'object' || Array.isArray(references) || Object.keys(references).length === 0) throw new ComponentGraphError('FAILED_COMPONENT', `component property references on ${nodeId} must be a non-empty map`);
  for (const [field, propertyName] of Object.entries(references)) {
    const expectedType = REFERENCE_FIELDS[field];
    if (!expectedType || typeof propertyName !== 'string' || !propertyName) throw new ComponentGraphError('FAILED_COMPONENT', `component property reference ${nodeId}.${field} has invalid field/property name`);
    if (field === 'characters' && nodeType !== 'TEXT') throw new ComponentGraphError('FAILED_COMPONENT', `characters property reference ${nodeId} requires a TEXT node`);
    if (field === 'mainComponent' && nodeType !== 'INSTANCE') throw new ComponentGraphError('FAILED_COMPONENT', `mainComponent property reference ${nodeId} requires an INSTANCE node`);
    if (owner.propertyDefinitions?.[propertyName]?.type !== expectedType) throw new ComponentGraphError('FAILED_COMPONENT', `component property reference ${nodeId}.${field} does not resolve to a ${expectedType} definition on ${owner.key}`);
  }
}

export function validateOverrideRecords(instanceId, overrides, parentById) {
  if (!Array.isArray(overrides)) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instanceId} overrides must be an array`);
  const seen = new Set();
  for (const row of overrides) {
    if (!row?.id || seen.has(row.id) || !isDescendant(row.id, instanceId, parentById)) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instanceId} override target ${row?.id ?? '?'} is missing, duplicate, or outside its subtree`);
    if (!Array.isArray(row.overriddenFields) || row.overriddenFields.length === 0 || row.overriddenFields.some((field) => !NODE_CHANGE_PROPERTIES.has(field))) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${instanceId} override ${row.id} has invalid overriddenFields`);
    seen.add(row.id);
  }
}

function componentOwner(nodeId, parentById, nodeTypes, supplementByNode, byId, byKey) {
  for (let ancestor = parentById.get(nodeId); ancestor; ancestor = parentById.get(ancestor)) {
    if (['COMPONENT', 'COMPONENT_SET'].includes(nodeTypes.get(ancestor)) && byId.has(ancestor)) return byId.get(ancestor);
    if (nodeTypes.get(ancestor) === 'INSTANCE') {
      const key = supplementByNode.get(ancestor)?.mainComponentKey;
      if (key && byKey.has(key)) return byKey.get(key);
    }
  }
  return null;
}

function isDescendant(nodeId, ancestorId, parentById) {
  for (let parent = parentById.get(nodeId); parent; parent = parentById.get(parent)) if (parent === ancestorId) return true;
  return false;
}

const NODE_CHANGE_PROPERTIES = new Set([
  'pointCount', 'name', 'width', 'height', 'parent', 'pluginData', 'constraints', 'locked', 'visible', 'opacity', 'blendMode',
  'layoutGrids', 'guides', 'characters', 'openTypeFeatures', 'styledTextSegments', 'vectorNetwork', 'effects', 'exportSettings',
  'arcData', 'autoRename', 'fontName', 'innerRadius', 'fontSize', 'lineHeight', 'leadingTrim', 'paragraphIndent', 'paragraphSpacing',
  'listSpacing', 'hangingPunctuation', 'hangingList', 'letterSpacing', 'textAlignHorizontal', 'textAlignVertical', 'textCase',
  'textDecoration', 'textAutoResize', 'fills', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
  'constrainProportions', 'strokes', 'strokeWeight', 'strokeAlign', 'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'booleanOperation',
  'overflowDirection', 'dashPattern', 'backgrounds', 'handleMirroring', 'cornerRadius', 'cornerSmoothing', 'relativeTransform', 'x', 'y',
  'rotation', 'isMask', 'clipsContent', 'type', 'overlayPositionType', 'overlayBackgroundInteraction', 'overlayBackground',
  'prototypeStartNode', 'prototypeBackgrounds', 'expanded', 'fillStyleId', 'strokeStyleId', 'backgroundStyleId', 'textStyleId',
  'effectStyleId', 'gridStyleId', 'description', 'layoutMode', 'paddingLeft', 'paddingTop', 'paddingRight', 'paddingBottom',
  'itemSpacing', 'layoutAlign', 'counterAxisSizingMode', 'primaryAxisSizingMode', 'primaryAxisAlignItems', 'counterAxisAlignItems',
  'layoutGrow', 'layoutPositioning', 'itemReverseZIndex', 'hyperlink', 'mediaData', 'stokeTopWeight', 'strokeBottomWeight',
  'strokeLeftWeight', 'strokeRightWeight', 'reactions', 'flowStartingPoints', 'shapeType', 'connectorStart', 'connectorEnd',
  'connectorLineType', 'connectorStartStrokeCap', 'connectorEndStrokeCap', 'codeLanguage', 'widgetSyncedState',
  'componentPropertyDefinitions', 'componentPropertyReferences', 'componentProperties', 'embedData', 'linkUnfurlData', 'text',
  'authorVisible', 'authorName', 'code', 'textBackground',
]);
