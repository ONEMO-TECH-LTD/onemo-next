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
  const definitions = [...components.componentSets, ...components.components].map((row) => structuredClone(row));
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
  (function walk(node) { if (!node) return; nodeTypes.set(node.id, node.type); (node.children ?? []).forEach(walk); })(document);
  const definitionSupplements = [];
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
    if (!row.mainComponentKey) continue;
    if (nodeTypes.get(row.nodeId) !== 'INSTANCE') throw new ComponentGraphError('FAILED_COMPONENT', `component instance supplement ${row.nodeId} has no INSTANCE node`);
    if (!byKey.has(row.mainComponentKey)) throw new ComponentGraphError('FAILED_COMPONENT', `instance ${row.nodeId} references unreadable component ${row.mainComponentKey}`);
    validateInstanceProperties(row, byKey);
    instances.push({
      nodeId: row.nodeId,
      mainComponentKey: row.mainComponentKey,
      componentProperties: structuredClone(row.componentProperties ?? {}),
      componentPropertyReferences: structuredClone(row.componentPropertyReferences ?? {}),
      overrides: structuredClone(row.overrides ?? []),
    });
  }
  for (const [nodeId, type] of nodeTypes) if (type === 'INSTANCE' && !instances.some((row) => row.nodeId === nodeId)) {
    throw new ComponentGraphError('FAILED_COMPONENT', `instance ${nodeId} lacks complete plugin semantics`);
  }
  return { schemaVersion: SCHEMA.componentGraph, definitions, definitionSupplements, instances };
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
