/** Standalone C11 §4 plugin reader. No imports; authority audit runs over these exact bytes. */
export function createCaptureAdapter(figma) {
  const observations = [];
  const listeners = [];
  const reader = Object.freeze({
    copy(value) {
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value));
    },
    aliasIds(value) {
      if (Array.isArray(value)) return value.flatMap((item) => reader.aliasIds(item));
      if (value === null || typeof value !== 'object') return [];
      const own = value.type === 'VARIABLE_ALIAS' && typeof value.id === 'string' ? [value.id] : [];
      return own.concat(Object.values(value).flatMap((item) => reader.aliasIds(item)));
    },
    imageRefs(value) {
      if (Array.isArray(value)) return value.flatMap((item) => reader.imageRefs(item));
      if (value === null || typeof value !== 'object') return [];
      const own = Object.entries(value).flatMap(([key, child]) => (
        (key === 'imageRef' || key === 'imageHash') && typeof child === 'string' ? [child] : []
      ));
      return own.concat(Object.values(value).flatMap((item) => reader.imageRefs(item)));
    },
    componentRow(node) {
      if (node.type === 'COMPONENT_SET') return {
        kind: 'component-set', id: node.id, key: node.key, name: node.name, remote: node.remote === true,
        complete: true, propertyDefinitions: reader.copy(node.componentPropertyDefinitions ?? {}),
      };
      return {
        kind: 'component', id: node.id, key: node.key, name: node.name, remote: node.remote === true,
        complete: true,
        componentSetKey: node.parent?.type === 'COMPONENT_SET' ? node.parent.key : null,
        variantProperties: reader.copy(node.variantProperties ?? null),
        propertyDefinitions: reader.copy(node.componentPropertyDefinitions ?? {}),
      };
    },
    async captureNode(node, rows, catalog) {
      const row = {
        nodeId: node.id,
        nodeType: node.type,
        resolvedVariableModes: reader.copy(node.resolvedVariableModes ?? {}),
        explicitVariableModes: reader.copy(node.explicitVariableModes ?? {}),
        ...(node.componentPropertyReferences === null || node.componentPropertyReferences === undefined
          ? {} : { componentPropertyReferences: reader.copy(node.componentPropertyReferences) }),
      };
      if (node.type === 'TEXT') {
        const fields = [
          'fontSize', 'fontName', 'fontWeight', 'fontStyle', 'textDecoration', 'textDecorationStyle',
          'textDecorationOffset', 'textDecorationThickness', 'textDecorationColor', 'textDecorationSkipInk',
          'textCase', 'lineHeight', 'letterSpacing', 'fills', 'textStyleId', 'fillStyleId', 'listOptions',
          'listSpacing', 'indentation', 'paragraphIndent', 'paragraphSpacing', 'hyperlink', 'openTypeFeatures',
          'boundVariables', 'textStyleOverrides',
        ];
        const segments = node.getStyledTextSegments(fields);
        Object.freeze(fields);
        rows.push({ ...row, styledTextSegments: reader.copy(segments) });
      } else if (node.type === 'INSTANCE') {
        const main = await node.getMainComponentAsync();
        if (main === null) throw new Error(`instance ${node.id} main component unavailable`);
        catalog.push(reader.componentRow(main));
        if (main.parent?.type === 'COMPONENT_SET') catalog.push(reader.componentRow(main.parent));
        rows.push({
          ...row, mainComponentKey: main.key,
          componentProperties: reader.copy(node.componentProperties ?? {}),
          overrides: reader.copy(node.overrides ?? []),
        });
      } else {
        if (node.type === 'COMPONENT' || node.type === 'COMPONENT_SET') {
          catalog.push(reader.componentRow(node));
          rows.push({ ...row, componentPropertyDefinitions: reader.copy(node.componentPropertyDefinitions ?? {}) });
        } else rows.push(row);
      }
      for (const child of node.children ?? []) await reader.captureNode(child, rows, catalog);
    },
    async expandVariables(ids, known) {
      const knownIds = new Set(known.map((row) => row.id));
      const missing = Array.from(new Set(ids)).filter((id) => !knownIds.has(id));
      if (!missing.length) return known;
      const fetched = await Promise.all(missing.map((id) => figma.variables.getVariableByIdAsync(id)));
      if (fetched.some((row) => row === null)) throw new Error('referenced variable unavailable');
      const next = known.concat(fetched);
      if (next.length > 100000) throw new Error('variable capture exceeds closed bound');
      const nextIds = new Set(next.map((row) => row.id));
      const aliases = reader.aliasIds(fetched.map((row) => row.valuesByMode)).filter((id) => !nextIds.has(id));
      return aliases.length ? reader.expandVariables(aliases, next) : next;
    },
    variableRow(variable, valuesByMode) {
      return {
        id: variable.id, key: variable.key, name: variable.name, description: variable.description,
        remote: variable.remote === true, variableCollectionId: variable.variableCollectionId,
        resolvedType: variable.resolvedType, valuesByMode: reader.copy(valuesByMode),
        scopes: reader.copy(variable.scopes ?? []), codeSyntax: reader.copy(variable.codeSyntax ?? {}),
        hiddenFromPublishing: variable.hiddenFromPublishing === true,
      };
    },
    collectionRow(collection) {
      return {
        id: collection.id, key: collection.key, name: collection.name, remote: collection.remote === true,
        isExtension: collection.isExtension === true, defaultModeId: collection.defaultModeId,
        modes: reader.copy(collection.modes), variableIds: reader.copy(collection.variableIds),
        hiddenFromPublishing: collection.hiddenFromPublishing === true,
        ...(typeof collection.parentVariableCollectionId === 'string' ? { parentVariableCollectionId: collection.parentVariableCollectionId } : {}),
        ...(typeof collection.rootVariableCollectionId === 'string' ? { rootVariableCollectionId: collection.rootVariableCollectionId } : {}),
      };
    },
    async captureRoot({ rootId, assetNodeIds = [] }) {
      if (typeof rootId !== 'string' || !rootId || !Array.isArray(assetNodeIds)
        || assetNodeIds.some((id) => typeof id !== 'string' || !id)) throw new Error('capture root request malformed');
      const root = await figma.getNodeByIdAsync(rootId);
      if (root === null || typeof root.exportAsync !== 'function') throw new Error(`capture root ${rootId} unavailable`);
      const exported = await root.exportAsync({ format: 'JSON_REST_V1' });
      const capturedTree = reader.copy(exported.document);
      if (capturedTree === undefined || capturedTree.id !== rootId) throw new Error('JSON_REST_V1 root identity mismatch');

      const rows = [];
      const componentCatalog = [];
      await reader.captureNode(root, rows, componentCatalog);
      const supplement = { schemaVersion: 1, nodes: rows };

      const localVariables = await figma.variables.getLocalVariablesAsync();
      const referencedIds = reader.aliasIds({ capturedTree, supplement, localVariables });
      const variableObjects = await reader.expandVariables(referencedIds, localVariables);
      const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
      const localCollectionIds = new Set(localCollections.map((row) => row.id));
      const modeCollectionIds = supplement.nodes.flatMap((row) => Object.keys(row.resolvedVariableModes).concat(Object.keys(row.explicitVariableModes)));
      const missingCollectionIds = Array.from(new Set(variableObjects.map((row) => row.variableCollectionId).concat(modeCollectionIds)))
        .filter((id) => !localCollectionIds.has(id));
      const remoteCollections = await Promise.all(missingCollectionIds.map((id) => figma.variables.getVariableCollectionByIdAsync(id)));
      if (remoteCollections.some((row) => row === null)) throw new Error('referenced variable collection unavailable');
      const collections = localCollections.concat(remoteCollections);
      const collectionById = new Map(collections.map((row) => [row.id, row]));
      const variables = await Promise.all(variableObjects.map(async (variable) => {
        const collection = collectionById.get(variable.variableCollectionId);
        if (collection === undefined) throw new Error(`variable ${variable.id} collection unavailable`);
        const values = collection.isExtension === true
          ? await variable.valuesByModeForCollectionAsync(collection) : variable.valuesByMode;
        return reader.variableRow(variable, values);
      }));

      const imageRefs = Array.from(new Set(reader.imageRefs({ capturedTree, supplement })));
      const images = await Promise.all(imageRefs.map(async (sourceId) => {
        const image = figma.getImageByHash(sourceId);
        if (image === null) throw new Error(`image ${sourceId} unavailable`);
        const results = await Promise.all([image.getBytesAsync(), image.getSizeAsync()]);
        return { sourceId, bytes: Array.from(results.at(0)), width: results.at(1).width, height: results.at(1).height };
      }));
      const exports = await Promise.all(assetNodeIds.map(async (sourceId) => {
        if (!rows.some((row) => row.nodeId === sourceId)) throw new Error(`asset node ${sourceId} outside capture root`);
        const node = await figma.getNodeByIdAsync(sourceId);
        if (node === null || typeof node.exportAsync !== 'function') throw new Error(`asset node ${sourceId} unavailable`);
        const svg = await node.exportAsync({ format: 'SVG_STRING' });
        if (typeof svg !== 'string' || !svg) throw new Error(`asset node ${sourceId} SVG unavailable`);
        return { sourceId, svg, width: node.width, height: node.height };
      }));

      return {
        schemaVersion: 1,
        proofClass: 'figma-plugin-capture',
        plugin: {
          fileKey: figma.fileKey, apiVersion: figma.apiVersion, editorType: figma.editorType,
          currentPageId: figma.currentPage.id, colorProfile: figma.root.documentColorProfile,
        },
        rootId,
        'document': capturedTree,
        supplement,
        variables,
        variableCollections: collections.map((row) => reader.collectionRow(row)),
        componentCatalog,
        images,
        exports,
        assetNodeIds: reader.copy(assetNodeIds),
      };
    },
  });

  return Object.freeze({
    beginObservation() {
      if (listeners.length) throw new Error('documentchange observation already active');
      observations.splice(0);
      const listener = (event) => observations.push({ count: Array.isArray(event.documentChanges) ? event.documentChanges.length : 1 });
      listeners.push(listener);
      figma.on('documentchange', listener);
    },
    endObservation() {
      if (listeners.length !== 1) throw new Error('documentchange observation not active');
      figma.off('documentchange', listeners.at(0));
      listeners.pop();
      return observations.map((row) => ({ count: row.count }));
    },
    async captureRoot(request) {
      return reader.captureRoot(request);
    },
  });
}
