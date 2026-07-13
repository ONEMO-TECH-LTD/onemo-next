/** Staged, project-generic token identity (§6.1). Pure: never writes persistent registry state. */
import { DOMAINS, SCHEMA, schemaError } from './schema.mjs';
import { canonicalJson, sha256 } from './evidence.mjs';
import { parseCanonicalModel } from './canonical-model.mjs';

const TYPES = new Set(['COLOR', 'FLOAT', 'STRING', 'BOOLEAN']);
const REACT_DOMAINS = new Set(['react-content', 'react-visibility', 'react-component-prop']);
const CSS_NAME = /^--[A-Za-z_][A-Za-z0-9_-]*$/;

export class RegistryError extends Error {
  constructor(message) { super(message); this.state = 'FAILED_BINDING'; }
}

export const emptyTokenRegistry = () => ({ schemaVersion: SCHEMA.tokenRegistry, generation: 0, entries: {} });
export const registryHash = (registry) => sha256(canonicalJson(registry));

export function stageTokenRegistry({ model, baseRegistry, webSyntaxPolicy = () => null }) {
  validateRegistry(baseRegistry);
  try { model = parseCanonicalModel(model); }
  catch (error) { throw new RegistryError(`canonical model refused: ${error.message}`); }
  if (typeof webSyntaxPolicy !== 'function') throw new RegistryError('webSyntaxPolicy must be a function');
  const candidate = structuredClone(baseRegistry);
  const variableByKey = new Map(model.variableGraph.variables.map((row) => [row.key, row]));
  const required = new Map();
  for (const record of model.bindingGraph.records) {
    const variable = variableByKey.get(record.variable?.key);
    if (!variable?.key) throw new RegistryError(`binding ${record.bindingId ?? '?'} has no stable variable catalog entry`);
    if (!required.has(variable.key)) required.set(variable.key, new Set());
    required.get(variable.key).add(record.destinationDomain);
  }
  const usedCssNames = new Map();
  const usedSymbols = new Map();
  const usedChannelIds = new Map();
  indexDestinations(candidate, usedCssNames, usedSymbols, usedChannelIds);
  const delta = { addedEntries: [], addedChannels: [], migrations: [] };
  let registryChanged = false;

  for (const variableKey of [...required.keys()].sort()) {
    const variable = variableByKey.get(variableKey);
    if (!TYPES.has(variable.resolvedType)) throw new RegistryError(`variable ${variableKey} has unsupported type ${variable.resolvedType}`);
    const webSyntax = variable.codeSyntax?.WEB;
    if (webSyntax !== undefined && !CSS_NAME.test(webSyntax)) throw new RegistryError(`variable ${variableKey} has invalid explicit WEB syntax ${JSON.stringify(webSyntax)}`);
    let entry = candidate.entries[variableKey];
    if (entry) {
      if (entry.variableKey !== variableKey || entry.figmaType !== variable.resolvedType) throw new RegistryError(`registry type/identity conflict for ${variableKey}`);
    } else {
      entry = {
        variableKey,
        figmaType: variable.resolvedType,
        stableBase: `fg-${slug(variable.name)}-${shortHash(variableKey)}`,
        channels: {},
      };
      candidate.entries[variableKey] = entry;
      delta.addedEntries.push(variableKey);
      registryChanged = true;
    }
    for (const domain of DOMAINS.filter((name) => required.get(variableKey).has(name))) {
      const target = REACT_DOMAINS.has(domain) ? 'react' : 'css';
      const requested = target === 'css' && webSyntax !== undefined
        ? webSyntaxPolicy({ variable: structuredClone(variable), domain, syntax: webSyntax })
        : null;
      if (requested !== null && requested !== undefined && !CSS_NAME.test(requested)) throw new RegistryError(`WEB syntax policy returned invalid custom property ${JSON.stringify(requested)} for ${variableKey}/${domain}`);
      const existing = entry.channels[domain];
      if (existing) {
        if (existing.target !== target) throw new RegistryError(`registry target conflict for ${variableKey}/${domain}`);
        if (requested && requested !== existing.cssName) delta.migrations.push({ variableKey, domain, existing: existing.cssName, requested });
        continue;
      }
      const channelId = `ch_${shortHash(`${variableKey}\u241f${domain}\u241f${target}`, 12)}`;
      const channel = { channelId, target };
      if (target === 'css') channel.cssName = requested || `--${entry.stableBase}-${slug(domain)}`;
      else channel.tsSymbol = `token${pascal(entry.stableBase)}${pascal(domain)}`;
      claim(usedChannelIds, channel.channelId, `${variableKey}/${domain}`, 'channel id');
      if (channel.cssName) claim(usedCssNames, channel.cssName, `${variableKey}/${domain}`, 'CSS custom property');
      if (channel.tsSymbol) claim(usedSymbols, channel.tsSymbol, `${variableKey}/${domain}`, 'React token symbol');
      entry.channels[domain] = channel;
      delta.addedChannels.push({ variableKey, domain, ...structuredClone(channel) });
      registryChanged = true;
    }
  }
  if (registryChanged) candidate.generation = baseRegistry.generation + 1;
  validateRegistry(candidate);
  delta.addedEntries.sort();
  delta.addedChannels.sort((a, b) => `${a.variableKey}:${a.domain}`.localeCompare(`${b.variableKey}:${b.domain}`));
  delta.migrations.sort((a, b) => `${a.variableKey}:${a.domain}`.localeCompare(`${b.variableKey}:${b.domain}`));
  const baseHash = registryHash(baseRegistry);
  const candidateHash = registryHash(candidate);
  const deltaHash = sha256(canonicalJson(delta));
  return {
    schemaVersion: SCHEMA.tokenRegistryStage,
    baseGeneration: baseRegistry.generation,
    baseHash,
    candidateHash,
    stageId: shortHash(`${baseHash}\u241f${candidateHash}\u241f${deltaHash}`, 16),
    delta,
    candidateRegistry: candidate,
  };
}

export function assertRegistryStageCurrent(stage, currentRegistry) {
  validateRegistryStage(stage);
  validateRegistry(currentRegistry);
  if (currentRegistry.generation !== stage?.baseGeneration || registryHash(currentRegistry) !== stage?.baseHash) {
    throw new RegistryError('registry commit conflict: base generation/hash changed; rebase and revalidate candidate');
  }
  validateAdditiveDelta(stage, currentRegistry);
  return true;
}

export function validateRegistryStage(stage) {
  const versionError = schemaError('tokenRegistryStage', stage);
  if (versionError) throw new RegistryError(versionError);
  if (!Number.isInteger(stage.baseGeneration) || stage.baseGeneration < 0 || !/^[0-9a-f]{64}$/.test(stage.baseHash ?? '') || !/^[0-9a-f]{64}$/.test(stage.candidateHash ?? '') || !/^[0-9a-f]{16}$/.test(stage.stageId ?? '')) throw new RegistryError('registry stage identity invalid');
  if (!stage.delta || !Array.isArray(stage.delta.addedEntries) || !Array.isArray(stage.delta.addedChannels) || !Array.isArray(stage.delta.migrations)) throw new RegistryError('registry stage delta invalid');
  validateRegistry(stage.candidateRegistry);
  if (![stage.baseGeneration, stage.baseGeneration + 1].includes(stage.candidateRegistry.generation)) throw new RegistryError('registry stage candidate generation invalid');
  if (registryHash(stage.candidateRegistry) !== stage.candidateHash) throw new RegistryError('registry stage candidate hash mismatch');
  const deltaHash = sha256(canonicalJson(stage.delta));
  if (shortHash(`${stage.baseHash}\u241f${stage.candidateHash}\u241f${deltaHash}`, 16) !== stage.stageId) throw new RegistryError('registry stage id mismatch');
  return true;
}

function validateAdditiveDelta(stage, base) {
  const candidate = stage.candidateRegistry;
  for (const key of Object.keys(base.entries)) if (!candidate.entries[key]) throw new RegistryError(`registry stage removes existing identity ${key}`);
  const addedEntries = Object.keys(candidate.entries).filter((key) => !base.entries[key]).sort();
  const addedChannels = [];
  for (const [key, entry] of Object.entries(candidate.entries)) {
    const prior = base.entries[key];
    if (prior) {
      if (prior.variableKey !== entry.variableKey || prior.figmaType !== entry.figmaType || prior.stableBase !== entry.stableBase) throw new RegistryError(`registry stage rewrites existing identity ${key}`);
      for (const [domain, channel] of Object.entries(prior.channels)) if (canonicalJson(entry.channels?.[domain]) !== canonicalJson(channel)) throw new RegistryError(`registry stage rewrites/removes existing channel ${key}/${domain}`);
    }
    for (const [domain, channel] of Object.entries(entry.channels)) if (!prior?.channels?.[domain]) addedChannels.push({ variableKey: key, domain, ...structuredClone(channel) });
  }
  addedChannels.sort((a, b) => `${a.variableKey}:${a.domain}`.localeCompare(`${b.variableKey}:${b.domain}`));
  if (canonicalJson(addedEntries) !== canonicalJson(stage.delta.addedEntries) || canonicalJson(addedChannels) !== canonicalJson(stage.delta.addedChannels)) throw new RegistryError('registry stage delta disagrees with candidate');
  const changed = addedEntries.length > 0 || addedChannels.length > 0;
  if (candidate.generation !== base.generation + (changed ? 1 : 0)) throw new RegistryError('registry stage generation disagrees with delta');
}

export function validateRegistry(registry) {
  const versionError = schemaError('tokenRegistry', registry);
  if (versionError) throw new RegistryError(versionError);
  if (!Number.isInteger(registry.generation) || registry.generation < 0 || !registry.entries || typeof registry.entries !== 'object' || Array.isArray(registry.entries)) throw new RegistryError('registry generation/entries invalid');
  const css = new Map(), symbols = new Map(), ids = new Map();
  for (const [key, entry] of Object.entries(registry.entries)) {
    if (entry?.variableKey !== key || !TYPES.has(entry?.figmaType) || typeof entry?.stableBase !== 'string' || !entry.stableBase || !entry.channels || typeof entry.channels !== 'object' || Array.isArray(entry.channels)) throw new RegistryError(`registry entry ${key} invalid`);
    for (const [domain, channel] of Object.entries(entry.channels)) {
      if (!DOMAINS.includes(domain) || !channel?.channelId || !['css', 'react'].includes(channel.target)) throw new RegistryError(`registry channel ${key}/${domain} invalid`);
      if (REACT_DOMAINS.has(domain) !== (channel.target === 'react')) throw new RegistryError(`registry channel ${key}/${domain} target/domain mismatch`);
      if (channel.target === 'css' && (!CSS_NAME.test(channel.cssName ?? '') || channel.tsSymbol !== undefined)) throw new RegistryError(`registry CSS channel ${key}/${domain} invalid`);
      if (channel.target === 'react' && (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(channel.tsSymbol ?? '') || channel.cssName !== undefined)) throw new RegistryError(`registry React channel ${key}/${domain} invalid`);
      claim(ids, channel.channelId, `${key}/${domain}`, 'channel id');
      if (channel.cssName) claim(css, channel.cssName, `${key}/${domain}`, 'CSS custom property');
      if (channel.tsSymbol) claim(symbols, channel.tsSymbol, `${key}/${domain}`, 'React token symbol');
    }
  }
  return true;
}

function indexDestinations(registry, css, symbols, ids) {
  for (const [key, entry] of Object.entries(registry.entries)) for (const [domain, channel] of Object.entries(entry.channels)) {
    claim(ids, channel.channelId, `${key}/${domain}`, 'channel id');
    if (channel.cssName) claim(css, channel.cssName, `${key}/${domain}`, 'CSS custom property');
    if (channel.tsSymbol) claim(symbols, channel.tsSymbol, `${key}/${domain}`, 'React token symbol');
  }
}

function claim(index, value, owner, label) {
  const prior = index.get(value);
  if (prior && prior !== owner) throw new RegistryError(`duplicate ${label} ${value}: ${prior} and ${owner}`);
  index.set(value, owner);
}

function shortHash(value, length = 8) { return sha256(String(value)).slice(0, length); }
function slug(value) { return String(value ?? 'token').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'token'; }
function pascal(value) { return slug(value).split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(''); }
