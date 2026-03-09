#!/usr/bin/env node
/**
 * generate-token-mapping.mjs — ONEMO Token Mapping Generator
 *
 * Instruments the build-tokens.mjs conversion pipeline to produce a complete
 * mapping table of every token transformation.
 *
 * Outputs:
 *   - scripts/token-mapping.json  (structured, machine-readable)
 *   - scripts/token-mapping.md    (human-readable table)
 *
 * Usage:
 *   node scripts/generate-token-mapping.mjs
 *
 * Does NOT modify build-tokens.mjs — this is a standalone wrapper.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, formatCss, converter } from 'culori';
import { CONFIG } from './tokens.config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Copied helpers from build-tokens.mjs (read-only, no modification) ───────

const toOklch = converter('oklch');

const FONT_WEIGHT_MAP = {
  'ExtraLight': 200, 'Extra Light': 200, 'Light': 300, 'Regular': 400,
  'Medium': 500, 'SemiBold': 600, 'Semi Bold': 600, 'Bold': 700,
  'ExtraBold': 800, 'Extra Bold': 800, 'Black': 900,
  'Regular Italic': 400, 'Medium Italic': 500, 'Semi Bold Italic': 600, 'Bold Italic': 700,
};

const FONT_FAMILY_ALIAS_MAP = { 'Primary': 'primary', 'Body': 'body' };

const COLLECTION_NAMES = {
  primitiveColor:           ['1.0_Primitive_Colours'],
  primitiveDimensions:      ['1.1_Primitive_Dimensions'],
  primitiveType:            ['1.2_Primitive_Type'],
  primitiveFluidSpacing:    ['1.3_Primitive_Fluid_Spacing'],
  primitiveFluidTypeSize:   ['1.4_Primitive_Fluid_Type_Size'],
  primitiveFluidTypeHeight: ['1.5_Primitive_Fluid_Type_Height'],
  aliasColor:       ['2.0_Alias_Colours'],
  aliasType:        ['2.1_Alias_Type'],
  aliasRadius:      ['2.2_Alias_Radius'],
  aliasWidth:       ['2.3_Alias_Width'],
  aliasSpacing:     ['2.4_Alias_Spacing'],
  aliasSize:        ['2.5_Alias_Size'],
  aliasBorderWidth: ['2.6_Alias_Border_Width'],
  aliasBreakpoints: ['2.7_Alias_Breakpoints'],
  semanticColors:     ['3.0_Semantic_Colours'],
  semanticType:       ['3.1_Semantic_Type'],
  semanticSpacing:    ['3.2_Semantic_Spacing'],
  semanticWidth:      ['3.3_Semantic_Width'],
  semanticContainers: ['3.4_Semantic_Containers'],
  semanticRadius:     ['3.5_Semantic_Radius'],
  semanticSize:       ['3.6_Semantic_Size'],
  componentColors: ['4.0_Component_Colours'],
  effects:         ['5.0_Effects'],
  primitiveLegacy:          ['_Primitives'],
  aliasLegacy:              ['_Alias'],
  utility:                  ['6.0_Utility'],
  semanticColorsLegacy:     ['1. Color modes'],
  semanticTypeLegacy:       ['6. Typography'],
  semanticSpacingLegacy:    ['3. Spacing'],
  semanticWidthLegacy:      ['4. Widths'],
  semanticContainersLegacy: ['5. Containers'],
  semanticRadiusLegacy:     ['2. Radius'],
};

function toKebab(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, '')
    .replace(/\u2024/g, '-')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/gray/g, 'grey')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function toKebabPreserveMode(str) {
  return str
    .toLowerCase()
    .replace(/\s*\(([^)]*)\)\s*/g, (match, content) => {
      if (content.includes('light mode') || content.includes('dark mode')) {
        return '-' + content.replace(/\s+mode\b/g, '').trim().replace(/\s+/g, '-');
      }
      return '';
    })
    .replace(/\u2024/g, '-')
    .replace(/\s+/g, '-')
    .replace(/_/g, '-')
    .replace(/gray/g, 'grey')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function letterSpacingToEm(percentValue) {
  if (percentValue === 0) return '0';
  const em = percentValue / 100;
  const rounded = Math.round(em * 10000) / 10000;
  return `${rounded}em`;
}

function pxToRem(px) {
  if (px === 0) return '0px';
  const rem = px / 16;
  const rounded = Math.round(rem * 10000) / 10000;
  return `${rounded}rem`;
}

function roundNumber(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatRounded(value, decimals) {
  const rounded = roundNumber(value, decimals);
  if (Object.is(rounded, -0)) return '0';
  return rounded.toString();
}

function formatColorToOklch(value) {
  const trimmed = String(value).trim();
  if (!trimmed.startsWith('#') && !/^rgba?\(/i.test(trimmed)) return value;
  const parsed = parse(trimmed);
  if (!parsed) return value;
  const converted = toOklch(parsed);
  if (!converted || typeof converted.l !== 'number' || typeof converted.c !== 'number') return formatCss(parsed);
  const lightness = `${formatRounded(converted.l * 100, 2)}%`;
  const chroma = formatRounded(converted.c, 3);
  const hue = formatRounded(Number.isFinite(converted.h) ? converted.h : 0, 2);
  const alpha = typeof converted.alpha === 'number' ? converted.alpha : 1;
  if (alpha < 1) return `oklch(${lightness} ${chroma} ${hue} / ${formatRounded(alpha * 100, 2)}%)`;
  return `oklch(${lightness} ${chroma} ${hue})`;
}

function parseCollections(json) {
  const collections = new Map();
  for (const entry of json) {
    const collectionName = Object.keys(entry)[0];
    collections.set(collectionName, entry[collectionName]);
  }
  return collections;
}

function findCollection(collections, candidateNames) {
  for (const name of candidateNames) {
    if (collections.has(name)) return { name, collection: collections.get(name) };
  }
  return null;
}

function requireCollection(collections, candidateNames, label) {
  const result = findCollection(collections, candidateNames);
  if (!result) throw new Error(`Missing collection for ${label}. Tried: ${candidateNames.join(', ')}`);
  return result;
}

function hasAnyCollection(collections, candidateNames) {
  return candidateNames.some(name => collections.has(name));
}

function getModeData(collection, preferredNames = []) {
  const modes = collection?.modes;
  if (!modes || typeof modes !== 'object') throw new Error('Collection has no modes');
  for (const name of preferredNames) {
    if (modes[name]) return modes[name];
  }
  const firstMode = Object.values(modes)[0];
  if (!firstMode) throw new Error('Collection modes are empty');
  return firstMode;
}

function getLightDarkModes(collection) {
  const entries = Object.entries(collection?.modes || {});
  const light = entries.find(([n]) => /light/i.test(n));
  const dark = entries.find(([n]) => /dark/i.test(n));
  if (!light || !dark) return null;
  return { lightName: light[0], darkName: dark[0], lightMode: light[1], darkMode: dark[1] };
}

function prependCategory(path, category) {
  if (!category || path[0] === category) return path;
  return [category, ...path];
}

function isSemanticColorCollectionName(collectionName) {
  return [
    ...COLLECTION_NAMES.semanticColors, ...COLLECTION_NAMES.componentColors,
    ...COLLECTION_NAMES.effects, ...COLLECTION_NAMES.utility, ...COLLECTION_NAMES.semanticColorsLegacy,
  ].includes(collectionName);
}

function isAliasCollectionName(collectionName) {
  return [...COLLECTION_NAMES.aliasColor, ...COLLECTION_NAMES.aliasType, ...COLLECTION_NAMES.aliasLegacy].includes(collectionName);
}

function isPrimitiveCollectionName(collectionName) {
  return [...COLLECTION_NAMES.primitiveColor, ...COLLECTION_NAMES.primitiveDimensions,
    ...COLLECTION_NAMES.primitiveType, ...COLLECTION_NAMES.primitiveLegacy].includes(collectionName);
}

function getCollectionForReference(collections, collectionName, refPath) {
  if (collectionName && collections.has(collectionName)) return collections.get(collectionName);
  const root = refPath.split('.')[0];
  if (collectionName === '_Primitives') {
    if (root === 'Colors') return findCollection(collections, [...COLLECTION_NAMES.primitiveColor, ...COLLECTION_NAMES.primitiveLegacy])?.collection;
    if (root === 'Dimensions') return findCollection(collections, [...COLLECTION_NAMES.primitiveDimensions, ...COLLECTION_NAMES.primitiveLegacy])?.collection;
    if (root === 'Typography') return findCollection(collections, [...COLLECTION_NAMES.primitiveType, ...COLLECTION_NAMES.primitiveLegacy])?.collection;
  }
  if (collectionName === '_Alias') {
    if (root === 'Colors') return findCollection(collections, [...COLLECTION_NAMES.aliasColor, ...COLLECTION_NAMES.aliasLegacy])?.collection;
    if (root === 'Typography') return findCollection(collections, [...COLLECTION_NAMES.aliasType, ...COLLECTION_NAMES.aliasLegacy])?.collection;
  }
  if (collectionName === '1. Color modes') return findCollection(collections, [...COLLECTION_NAMES.semanticColors, ...COLLECTION_NAMES.semanticColorsLegacy])?.collection;
  return null;
}

function getSemanticColorCollections(collections) {
  const collectionsToUse = [];
  const baseSemantic = findCollection(collections, [...COLLECTION_NAMES.semanticColors, ...COLLECTION_NAMES.semanticColorsLegacy]);
  if (baseSemantic) collectionsToUse.push(baseSemantic);
  for (const names of [COLLECTION_NAMES.componentColors, COLLECTION_NAMES.effects, COLLECTION_NAMES.utility]) {
    const found = findCollection(collections, names);
    if (found) collectionsToUse.push(found);
  }
  return collectionsToUse;
}

function walkPath(obj, pathStr) {
  const segments = pathStr.split('.');
  let current = obj;
  for (const seg of segments) {
    if (!current || typeof current !== 'object') return undefined;
    if (seg in current) { current = current[seg]; } else { return undefined; }
  }
  return current;
}

function resolveReference(value, collectionName, collections, depth = 0) {
  if (depth > 5) return value;
  if (typeof value !== 'string' || !value.startsWith('{') || !value.endsWith('}')) return value;
  const path = value.slice(1, -1);
  const targetCollection = getCollectionForReference(collections, collectionName, path);
  if (!targetCollection) return value;
  const modes = targetCollection.modes;
  for (const modeName of Object.keys(modes)) {
    const result = walkPath(modes[modeName], path);
    if (result && result.$value !== undefined) {
      const nextCollection = result.$collectionName || collectionName;
      return resolveReference(result.$value, nextCollection, collections, depth + 1);
    }
  }
  return value;
}

function resolveToPx(node, preferredMode, collections, depth = 0) {
  if (depth > 6) return null;
  if (typeof node.$value === 'number') return node.$value;
  if (typeof node.$value === 'string' && node.$value.startsWith('{')) {
    const path = node.$value.slice(1, -1);
    const collName = node.$collectionName;
    const coll = collections.get(collName);
    if (!coll) return null;
    const mode = coll.modes?.[preferredMode] || Object.values(coll.modes)[0];
    if (!mode) return null;
    const targetNode = walkPath(mode, path);
    if (!targetNode) return null;
    return resolveToPx(targetNode, preferredMode, collections, depth + 1);
  }
  return null;
}

function resolveFluidValues(node, collections) {
  const refCollName = node.$collectionName;
  const refValue = node.$value;
  if (!refCollName || typeof refValue !== 'string' || !refValue.startsWith('{')) return null;
  const path = refValue.slice(1, -1);
  const coll = collections.get(refCollName);
  if (!coll) return null;
  const desktopMode = coll.modes?.['Desktop'];
  const mobileMode = coll.modes?.['Mobile'];
  if (!desktopMode || !mobileMode) return null;
  const dNode = walkPath(desktopMode, path);
  const mNode = walkPath(mobileMode, path);
  if (!dNode || !mNode) return null;
  const dPx = resolveToPx(dNode, 'Desktop', collections);
  const mPx = resolveToPx(mNode, 'Mobile', collections);
  if (dPx === null || mPx === null) return null;
  return { desktopPx: dPx, mobilePx: mPx };
}

function generateClamp(minPx, maxPx, minWidth, maxWidth) {
  if (minPx === maxPx) return minPx === 0 ? '0px' : pxToRem(minPx);
  const slope = (maxPx - minPx) / (maxWidth - minWidth);
  const intercept = minPx - slope * minWidth;
  const r = px => parseFloat((px / 16).toFixed(4));
  const t = n => parseFloat(n.toFixed(4));
  return `clamp(${r(minPx)}rem, ${t(intercept / 16)}rem + ${t(slope * 100)}vi, ${r(maxPx)}rem)`;
}

function flattenTree(obj, pathSoFar = []) {
  const results = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    if (val && typeof val === 'object' && '$value' in val) {
      results.push({ path: [...pathSoFar, key], node: val });
    } else if (val && typeof val === 'object') {
      results.push(...flattenTree(val, [...pathSoFar, key]));
    }
  }
  return results;
}

function buildPrimitiveName(path) {
  const category = path[0];
  if (category === 'Colors') {
    const parts = path.slice(1).filter(p => p !== 'ONEMO - UI Palette' && p !== 'Dusty' && p !== 'Neutral');
    return `--primitive-color-${parts.map(p => toKebabPreserveMode(p)).join('-')}`;
  }
  if (category === 'Dimensions') return `--primitive-dimension-${toKebab(path[1])}`;
  if (category === 'Typography') {
    const subCategory = path[1];
    if (subCategory === 'Type Scale') return `--primitive-type-scale-${path[2]}`;
    if (subCategory === 'Letter Spacing') {
      const rawName = path[2];
      if (rawName === 'zero') return '--primitive-letter-spacing-0';
      if (rawName.startsWith('+')) return `--primitive-letter-spacing-pos-${rawName.slice(1)}`;
      if (rawName.startsWith('-')) return `--primitive-letter-spacing-neg-${rawName.slice(1)}`;
      return `--primitive-letter-spacing-${rawName}`;
    }
    if (subCategory === 'Font Family') return `--primitive-font-${toKebab(path[path.length - 1])}`;
    if (subCategory === 'Paragraph Spacing') return `--primitive-paragraph-spacing-${toKebab(path[2])}`;
  }
  return `--primitive-${path.map(p => toKebab(p)).join('-')}`;
}

function formatPrimitiveValue(path, node) {
  const category = path[0];
  const value = node.$value;
  if (category === 'Colors') return formatColorToOklch(value);
  if (category === 'Dimensions') {
    if (typeof value === 'number') return value === 0 ? '0px' : pxToRem(value);
    return `${value}`;
  }
  if (category === 'Typography') {
    const subCategory = path[1];
    if (subCategory === 'Type Scale') return typeof value === 'number' ? pxToRem(value) : `${value}`;
    if (subCategory === 'Letter Spacing') return typeof value === 'number' ? letterSpacingToEm(value) : `${value}`;
    if (subCategory === 'Font Family') {
      const fontName = String(value);
      const generic = fontName.toLowerCase().includes('mono') ? 'monospace' : 'sans-serif';
      return `"${fontName}", ${generic}`;
    }
    if (subCategory === 'Paragraph Spacing') return typeof value === 'number' ? `${value}px` : `${value}`;
  }
  return `${value}`;
}

function buildPrimitiveRefFromPath(refPath) {
  const parts = refPath.split('.');
  if (parts[0] === 'Colors') {
    const filtered = parts.slice(1).filter(p => p !== 'ONEMO - UI Palette' && p !== 'Dusty' && p !== 'Neutral');
    return `--primitive-color-${filtered.map(p => toKebabPreserveMode(p)).join('-')}`;
  }
  if (parts[0] === 'Dimensions') return `--primitive-dimension-${toKebab(parts[1])}`;
  if (parts[0] === 'Typography') {
    if (parts[1] === 'Type Scale') return `--primitive-type-scale-${parts[2]}`;
    if (parts[1] === 'Font Family') return `--primitive-font-${toKebab(parts[parts.length - 1])}`;
    if (parts[1] === 'Letter Spacing') {
      const rawName = parts[2];
      if (rawName === 'zero') return '--primitive-letter-spacing-0';
      if (rawName.startsWith('+')) return `--primitive-letter-spacing-pos-${rawName.slice(1)}`;
      if (rawName.startsWith('-')) return `--primitive-letter-spacing-neg-${rawName.slice(1)}`;
    }
  }
  return `--primitive-${parts.map(p => toKebab(p)).join('-')}`;
}

function buildAliasRefFromPath(refPath) {
  const parts = refPath.split('.');
  if (parts[0] === 'Colors') {
    if (parts[1] === 'Brand') return `--alias-brand-${parts.slice(2).map(p => toKebab(p)).join('-')}`;
    if (parts[1] === 'System') return `--alias-${parts.slice(2).map(p => toKebab(p)).join('-')}`;
  }
  if (parts[0] === 'Typography') {
    if (parts[1] === 'Font-Family') {
      const key = parts[2];
      const name = FONT_FAMILY_ALIAS_MAP[key];
      return name ? `--alias-font-${name}` : `--alias-font-${toKebab(key)}`;
    }
  }
  return `--alias-${parts.map(p => toKebab(p)).join('-')}`;
}

function buildSemanticColorName(path) {
  const tokenName = path[path.length - 1];
  return toKebab(tokenName);
}

function buildColorValueRef(node, collections) {
  const value = node.$value;
  if (typeof value !== 'string' || !value.startsWith('{')) {
    if (typeof value === 'number' || (node.$type === 'float' && typeof value === 'number')) return `${value}px`;
    return value;
  }
  const collectionName = node.$collectionName;
  const refPath = value.slice(1, -1);
  if (isSemanticColorCollectionName(collectionName)) {
    const parts = refPath.split('.');
    const tokenName = parts[parts.length - 1];
    return `var(--semantic-${toKebab(tokenName)})`;
  }
  if (isAliasCollectionName(collectionName)) return `var(${buildAliasRefFromPath(refPath)})`;
  if (isPrimitiveCollectionName(collectionName)) return `var(${buildPrimitiveRefFromPath(refPath)})`;
  const resolved = resolveReference(value, collectionName, collections);
  return typeof resolved === 'string' ? resolved : `${resolved}`;
}

// Normalisation helpers (mirror from build-tokens.mjs)
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function isLeafTokenNode(value) { return isObject(value) && Object.prototype.hasOwnProperty.call(value, '$value'); }

function expandKeyValueArrays(value) {
  if (Array.isArray(value)) {
    const isKV = value.every(i => isObject(i) && 'key' in i && 'value' in i);
    if (isKV) {
      const out = {};
      for (const item of value) out[String(item.key)] = expandKeyValueArrays(item.value);
      return out;
    }
    return value.map(i => expandKeyValueArrays(i));
  }
  if (isObject(value)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = expandKeyValueArrays(v);
    return out;
  }
  return value;
}

function toTitleWords(value) {
  return String(value).split(/[\s_-]+/).filter(Boolean).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

function normaliseAliasFamilyKey(rawKey) {
  const key = String(rawKey).trim().toLowerCase();
  if (key === 'primary') return 'Primary';
  if (key === 'secondary - plain') return 'Secondary - Plain';
  if (key === 'secondary - deco') return 'Secondary - Deco';
  if (key === 'tertiary') return 'Tertiary';
  return toTitleWords(rawKey);
}

function normaliseAliasLetterSpacingKey(rawKey) {
  const key = String(rawKey).trim();
  if (key === 'zero' || key === '0') return 'LeS-0 - default';
  const positive = key.match(/^pos-(\d+)$/i);
  if (positive) return `+${positive[1]}`;
  const negative = key.match(/^neg-(\d+)$/i);
  if (negative) return `-${negative[1]}`;
  return key;
}

function wrapModeWithCategory(modeData, categoryName) {
  if (!isObject(modeData)) return modeData;
  if (isObject(modeData[categoryName])) return modeData;
  const metadata = {};
  const payload = {};
  for (const [k, v] of Object.entries(modeData)) {
    if (k.startsWith('$')) metadata[k] = v; else payload[k] = v;
  }
  return { ...metadata, [categoryName]: payload };
}

function normalisePrimitiveTypeMode(modeData) {
  if (!isObject(modeData)) return modeData;
  if (isObject(modeData.Typography)) return modeData;
  const basicFonts = isObject(modeData.basic) ? modeData.basic : {};
  const decorativeFonts = isObject(modeData.deco) ? modeData.deco : {};
  const typeScale = isObject(modeData.scale) ? modeData.scale : {};
  const letterSpacing = isObject(modeData.tracking) ? modeData.tracking : {};
  const paragraphSpacing = isObject(modeData.para) ? modeData.para : {};
  const fontFamily = {};
  if (Object.keys(basicFonts).length > 0) fontFamily.Basic = basicFonts;
  if (Object.keys(decorativeFonts).length > 0) fontFamily.Decorative = decorativeFonts;
  return { Typography: { 'Font Family': fontFamily, 'Type Scale': typeScale, 'Letter Spacing': letterSpacing, 'Paragraph Spacing': paragraphSpacing } };
}

function normaliseAliasColorMode(modeData) {
  if (!isObject(modeData)) return modeData;
  if (isObject(modeData.Colors) && (isObject(modeData.Colors.Brand) || isObject(modeData.Colors.System))) return modeData;
  const metadata = {};
  const groups = {};
  for (const [k, v] of Object.entries(modeData)) {
    if (k.startsWith('$')) metadata[k] = v; else groups[k] = v;
  }
  const colors = {};
  if (isObject(groups.brand)) colors.Brand = groups.brand;
  const system = {};
  for (const [k, v] of Object.entries(groups)) {
    if (k === 'brand') continue;
    system[toTitleWords(k)] = v;
  }
  if (Object.keys(system).length > 0) colors.System = system;
  return { ...metadata, Colors: colors };
}

function normaliseAliasTypeMode(modeData) {
  if (!isObject(modeData)) return modeData;
  const existingTypography = isObject(modeData.Typography) ? modeData.Typography : null;
  if (existingTypography && isObject(existingTypography['Font-Family'])) return modeData;
  const source = existingTypography || modeData;
  const familyRaw = isObject(source.family) ? source.family : (isObject(source['Font-Family']) ? source['Font-Family'] : {});
  const styleRaw = isObject(source.style) ? source.style : (isObject(source['Font-Style']) ? source['Font-Style'] : {});
  const sizeRaw = isObject(source.size) ? source.size : (isObject(source['Font-Size']) ? source['Font-Size'] : {});
  const heightRaw = isObject(source.height) ? source.height : (isObject(source['Line-Height']) ? source['Line-Height'] : {});
  const letterRawSource = isObject(source.ls) ? source.ls : (isObject(source['Letter-Spacing']) ? source['Letter-Spacing'] : {});
  const paragraphRaw = isObject(source.para) ? source.para : (isObject(source['Paragraph-Spacing']) ? source['Paragraph-Spacing'] : {});
  const family = {};
  for (const [k, v] of Object.entries(familyRaw)) {
    if (k.startsWith('$')) continue;
    family[normaliseAliasFamilyKey(k)] = v;
  }
  const letterRaw = {};
  for (const [k, v] of Object.entries(letterRawSource)) {
    if (k.startsWith('$')) continue;
    letterRaw[normaliseAliasLetterSpacingKey(k)] = v;
  }
  return { Typography: { 'Font-Family': family, 'Font-Style': styleRaw, 'Font-Size': sizeRaw, 'Line-Height': heightRaw, 'Letter-Spacing': letterRaw, 'Paragraph-Spacing': paragraphRaw } };
}

const SEMANTIC_PRESET_KEY_MAP = { font: 'Font', style: 'Style', size: 'Size', line: 'Line', letter: 'Letter', paragraph: 'Paragraph' };

function normaliseSemanticTypeMode(modeData) {
  if (!isObject(modeData)) return modeData;
  function visit(node) {
    if (!isObject(node) || isLeafTokenNode(node)) return node;
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const mappedKey = Object.prototype.hasOwnProperty.call(SEMANTIC_PRESET_KEY_MAP, k) ? SEMANTIC_PRESET_KEY_MAP[k] : k;
      out[mappedKey] = visit(v);
    }
    return out;
  }
  return visit(modeData);
}

function normalisePrefixedModeKeys(modeData, prefix) {
  if (!isObject(modeData)) return modeData;
  const out = {};
  for (const [k, v] of Object.entries(modeData)) {
    if (k.startsWith('$')) { out[k] = v; continue; }
    out[k.startsWith(prefix) ? k : `${prefix}${k}`] = v;
  }
  return out;
}

function normaliseReferencePath(refPath, targetCollection) {
  const path = String(refPath).trim();
  if (!path) return path;
  const parts = path.split('.');
  const first = parts[0];
  if (targetCollection === '1.0_Primitive_Colours') { return first === 'Colors' ? path : `Colors.${path}`; }
  if (targetCollection === '1.1_Primitive_Dimensions') { return first === 'Dimensions' ? path : `Dimensions.${path}`; }
  if (targetCollection === '1.2_Primitive_Type') {
    if (first === 'Typography') return path;
    if (first === 'basic') return `Typography.Font Family.Basic.${parts.slice(1).join('.')}`;
    if (first === 'deco') return `Typography.Font Family.Decorative.${parts.slice(1).join('.')}`;
    if (first === 'scale') return `Typography.Type Scale.${parts.slice(1).join('.')}`;
    if (first === 'tracking') return `Typography.Letter Spacing.${parts.slice(1).join('.')}`;
    if (first === 'para') return `Typography.Paragraph Spacing.${parts.slice(1).join('.')}`;
    return `Typography.${path}`;
  }
  if (targetCollection === '2.0_Alias_Colours') {
    if (first === 'Colors') return path;
    if (first.toLowerCase() === 'brand') return `Colors.Brand.${parts.slice(1).join('.')}`;
    if (['error', 'info', 'success', 'warning'].includes(first.toLowerCase())) return `Colors.System.${toTitleWords(first)}.${parts.slice(1).join('.')}`;
    return `Colors.${path}`;
  }
  if (targetCollection === '2.1_Alias_Type' || targetCollection === '_Alias') {
    if (first === 'Typography') return path;
    if (first.toLowerCase() === 'family') return `Typography.Font-Family.${normaliseAliasFamilyKey(parts.slice(1).join('.'))}`;
    if (first.toLowerCase() === 'style') return `Typography.Font-Style.${parts.slice(1).join('.')}`;
    if (first.toLowerCase() === 'size') return `Typography.Font-Size.${parts.slice(1).join('.')}`;
    if (first.toLowerCase() === 'height') return `Typography.Line-Height.${parts.slice(1).join('.')}`;
    if (first.toLowerCase() === 'ls') {
      const rest = parts.slice(1);
      if (rest.length === 0) return 'Typography.Letter-Spacing';
      const [token, ...tail] = rest;
      return `Typography.Letter-Spacing.${[normaliseAliasLetterSpacingKey(token), ...tail].join('.')}`;
    }
    if (first.toLowerCase() === 'para') return `Typography.Paragraph-Spacing.${parts.slice(1).join('.')}`;
    return path;
  }
  return path;
}

function rewriteReferences(value, currentCollectionName) {
  if (Array.isArray(value)) return value.map(item => rewriteReferences(item, currentCollectionName));
  if (!isObject(value)) return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = rewriteReferences(v, currentCollectionName);
  if (Object.prototype.hasOwnProperty.call(out, '$value') && typeof out.$value === 'string' && out.$value.startsWith('{') && out.$value.endsWith('}')) {
    const targetCollection = out.$collectionName || currentCollectionName;
    const innerPath = out.$value.slice(1, -1);
    out.$value = `{${normaliseReferencePath(innerPath, targetCollection)}}`;
  }
  return out;
}

function normaliseModeStructure(collectionName, modeData) {
  if (!isObject(modeData)) return modeData;
  if (collectionName === '1.0_Primitive_Colours') return wrapModeWithCategory(modeData, 'Colors');
  if (collectionName === '1.1_Primitive_Dimensions') return wrapModeWithCategory(modeData, 'Dimensions');
  if (collectionName === '1.2_Primitive_Type') return normalisePrimitiveTypeMode(modeData);
  if (collectionName === '2.0_Alias_Colours') return normaliseAliasColorMode(modeData);
  if (collectionName === '2.1_Alias_Type') return normaliseAliasTypeMode(modeData);
  if (collectionName === '3.1_Semantic_Type') return normaliseSemanticTypeMode(modeData);
  if (collectionName === '3.2_Semantic_Spacing') return normalisePrefixedModeKeys(modeData, 'spacing-');
  if (collectionName === '3.4_Semantic_Containers') return normalisePrefixedModeKeys(modeData, 'container-');
  if (collectionName === '3.5_Semantic_Radius') return normalisePrefixedModeKeys(modeData, 'radius-');
  return modeData;
}

function normaliseInputCollections(json) {
  if (!Array.isArray(json)) return json;
  return json.map(entry => {
    if (!isObject(entry)) return entry;
    const keys = Object.keys(entry);
    if (keys.length !== 1) return entry;
    const collectionName = keys[0];
    const collectionData = expandKeyValueArrays(entry[collectionName]);
    if (!isObject(collectionData) || !isObject(collectionData.modes)) return { [collectionName]: collectionData };
    const modes = {};
    for (const [modeName, modeData] of Object.entries(collectionData.modes)) {
      const expandedMode = expandKeyValueArrays(modeData);
      const structurallyNormalised = normaliseModeStructure(collectionName, expandedMode);
      modes[modeName] = rewriteReferences(structurallyNormalised, collectionName);
    }
    return { [collectionName]: { ...collectionData, modes } };
  });
}

// ─── Mapping Collectors ───────────────────────────────────────────────────────

/**
 * Collect all token mappings from the pipeline.
 * Returns an array of { figmaCollection, figmaPath, cssProperty, cssValue, valueType, tier, category }
 */
function collectAllTokenMappings(collections) {
  const tokens = [];

  // ─── Tier: primitive ────────────────────────────────────────────────────────

  const hasSplitPrimitives = hasAnyCollection(collections, [
    ...COLLECTION_NAMES.primitiveColor, ...COLLECTION_NAMES.primitiveDimensions, ...COLLECTION_NAMES.primitiveType,
  ]);

  const primitiveEntries = [];
  if (hasSplitPrimitives) {
    const primitiveSources = [
      { info: requireCollection(collections, [...COLLECTION_NAMES.primitiveColor, ...COLLECTION_NAMES.primitiveLegacy], 'Primitive colours'), category: 'Colors' },
      { info: requireCollection(collections, [...COLLECTION_NAMES.primitiveDimensions, ...COLLECTION_NAMES.primitiveLegacy], 'Primitive dimensions'), category: 'Dimensions' },
      { info: requireCollection(collections, [...COLLECTION_NAMES.primitiveType, ...COLLECTION_NAMES.primitiveLegacy], 'Primitive type'), category: 'Typography' },
    ];
    for (const { info, category } of primitiveSources) {
      const modeData = getModeData(info.collection, ['Core', 'Value', 'Mode 1']);
      for (const entry of flattenTree(modeData)) {
        primitiveEntries.push({ ...entry, path: prependCategory(entry.path, category), collectionName: info.name });
      }
    }
  } else {
    const primitives = requireCollection(collections, COLLECTION_NAMES.primitiveLegacy, 'Legacy primitives');
    const modeData = getModeData(primitives.collection, ['Core', 'Value', 'Mode 1']);
    for (const entry of flattenTree(modeData)) {
      primitiveEntries.push({ ...entry, collectionName: primitives.name });
    }
  }

  for (const { path, node, collectionName } of primitiveEntries) {
    const cssProperty = buildPrimitiveName(path);
    const cssValue = formatPrimitiveValue(path, node);
    const category = path[0]?.toLowerCase() || 'unknown';
    tokens.push({
      figmaCollection: collectionName,
      figmaPath: path.join('/'),
      cssProperty,
      cssValue,
      valueType: category === 'colors' ? 'color' : (typeof node.$value === 'number' ? 'dimension' : 'string'),
      tier: 'primitive',
      category,
    });
  }

  // ─── Tier: semantic — spacing ────────────────────────────────────────────────

  const spacingInfo = requireCollection(collections, [...COLLECTION_NAMES.semanticSpacing, ...COLLECTION_NAMES.semanticSpacingLegacy], 'Semantic spacing');
  const spacingMode = getModeData(spacingInfo.collection, ['Mode 1', 'Value', 'Style']);

  function collectSpacingToken(cssKey, node, collectionName) {
    if (!node || node.$value === undefined) return;
    const fluid = resolveFluidValues(node, collections);
    let cssValue;
    let valueType;
    if (fluid) {
      cssValue = generateClamp(fluid.mobilePx, fluid.desktopPx, CONFIG.viewportBounds.min, CONFIG.viewportBounds.max);
      valueType = 'fluid';
    } else {
      const resolvedValue = resolveReference(node.$value, node.$collectionName || '_Primitives', collections);
      cssValue = typeof resolvedValue === 'number' ? (resolvedValue === 0 ? '0px' : pxToRem(resolvedValue)) : `${resolvedValue}`;
      valueType = 'dimension';
    }
    tokens.push({
      figmaCollection: collectionName,
      figmaPath: cssKey.replace(/^spacing-/, 'spacing/'),
      cssProperty: `--${cssKey}`,
      cssValue,
      valueType,
      tier: 'semantic',
      category: 'spacing',
    });
  }

  for (const [key, node] of Object.entries(spacingMode)) {
    if (key.startsWith('$')) continue;
    if (node && node.$value !== undefined) {
      collectSpacingToken(key, node, spacingInfo.name);
    } else if (node && typeof node === 'object') {
      for (const [subKey, subNode] of Object.entries(node)) {
        if (subKey.startsWith('$')) continue;
        collectSpacingToken(`${key}-${subKey}`, subNode, spacingInfo.name);
      }
    }
  }

  // ─── Tier: semantic — radius ─────────────────────────────────────────────────

  const radiusInfo = requireCollection(collections, [...COLLECTION_NAMES.semanticRadius, ...COLLECTION_NAMES.semanticRadiusLegacy], 'Semantic radius');
  const radiusMode = getModeData(radiusInfo.collection, ['Mode 1', 'Value', 'Style']);
  for (const [key, node] of Object.entries(radiusMode)) {
    if (key.startsWith('$')) continue;
    const value = resolveReference(node.$value, node.$collectionName || '3.5_Semantic_Radius', collections);
    const cssValue = typeof value === 'number' ? `${value}px` : `${value}`;
    tokens.push({
      figmaCollection: radiusInfo.name,
      figmaPath: key.replace(/^radius-/, 'radius/'),
      cssProperty: `--${key}`,
      cssValue,
      valueType: 'dimension',
      tier: 'semantic',
      category: 'radius',
    });
  }

  // ─── Tier: semantic — breakpoints ────────────────────────────────────────────

  const breakpointMap = { sm: 480, md: 640, lg: 768, xl: 1024, '2xl': 1280, '3xl': 1440 };
  for (const [name, value] of Object.entries(breakpointMap)) {
    tokens.push({
      figmaCollection: 'hardcoded',
      figmaPath: `breakpoints/${name}`,
      cssProperty: `--breakpoint-${name}`,
      cssValue: `${value}px`,
      valueType: 'dimension',
      tier: 'semantic',
      category: 'breakpoints',
    });
  }

  // ─── Tier: semantic — font families ─────────────────────────────────────────

  const fontFamilyRefs = {};
  if (!CONFIG.emitAlias) {
    const aliasTypeInfo = findCollection(collections, COLLECTION_NAMES.aliasType) || findCollection(collections, COLLECTION_NAMES.aliasLegacy);
    if (aliasTypeInfo) {
      const atMode = getModeData(aliasTypeInfo.collection, ['Desktop', 'Style', 'Value', 'Mode 1']);
      const atTypo = atMode.Typography || atMode;
      const families = atTypo['Font-Family'] || {};
      for (const [key, node] of Object.entries(families)) {
        if (key.startsWith('$')) continue;
        const semanticName = FONT_FAMILY_ALIAS_MAP[key];
        if (!semanticName) continue;
        const resolved = resolveReference(node.$value, node.$collectionName || '_Primitives', collections);
        if (resolved) fontFamilyRefs[semanticName] = `var(--primitive-font-${toKebab(String(resolved))})`;
      }
    }
  }
  for (const name of Object.values(FONT_FAMILY_ALIAS_MAP)) {
    const ref = CONFIG.emitAlias ? `var(--alias-font-${name})` : fontFamilyRefs[name];
    if (!ref) continue;
    tokens.push({
      figmaCollection: '2.1_Alias_Type',
      figmaPath: `Typography/Font-Family/${name}`,
      cssProperty: `--font-${name}`,
      cssValue: ref,
      valueType: 'string',
      tier: 'semantic',
      category: 'typography',
    });
  }

  // ─── Tier: semantic — widths ─────────────────────────────────────────────────

  const widthsInfo = requireCollection(collections, [...COLLECTION_NAMES.semanticWidth, ...COLLECTION_NAMES.semanticWidthLegacy], 'Semantic width');
  const widthsMode = getModeData(widthsInfo.collection, ['Mode 1', 'Value', 'Style']);
  for (const [key, node] of Object.entries(widthsMode)) {
    if (key.startsWith('$')) continue;
    const resolvedValue = resolveReference(node.$value, node.$collectionName || '_Primitives', collections);
    const pxValue = typeof resolvedValue === 'number' ? resolvedValue : parseInt(resolvedValue, 10);
    const cssKey = `--width-${key.replace(/^width-/, '')}`;
    tokens.push({
      figmaCollection: widthsInfo.name,
      figmaPath: key.replace(/^width-/, 'width/'),
      cssProperty: cssKey,
      cssValue: `${pxValue}px`,
      valueType: 'dimension',
      tier: 'semantic',
      category: 'width',
    });
  }

  // ─── Tier: semantic — containers ─────────────────────────────────────────────

  const containersInfo = requireCollection(collections, [...COLLECTION_NAMES.semanticContainers, ...COLLECTION_NAMES.semanticContainersLegacy], 'Semantic containers');
  const containersMode = getModeData(containersInfo.collection, ['Value', 'Mode 1', 'Style']);
  for (const [key, node] of Object.entries(containersMode)) {
    if (key.startsWith('$')) continue;
    const resolvedValue = resolveReference(node.$value, node.$collectionName || '_Primitives', collections);
    const pxValue = typeof resolvedValue === 'number' ? resolvedValue : parseInt(resolvedValue, 10);
    const cssKey = `--container-${key.replace(/^container-/, '')}`;
    const cssValue = key.includes('padding') ? pxToRem(pxValue) : `${pxValue}px`;
    tokens.push({
      figmaCollection: containersInfo.name,
      figmaPath: key.replace(/^container-/, 'container/'),
      cssProperty: cssKey,
      cssValue,
      valueType: 'dimension',
      tier: 'semantic',
      category: 'containers',
    });
  }

  // ─── Tier: semantic — typography composites ──────────────────────────────────

  const typoInfo = requireCollection(collections, [...COLLECTION_NAMES.semanticType, ...COLLECTION_NAMES.semanticTypeLegacy], 'Semantic typography');
  const typoModeData = getModeData(typoInfo.collection, ['Value', 'Mode 1', 'Style']);

  function collectTypoPreset(presetName, preset, collectionName) {
    if (preset.Size) {
      const fluid = resolveFluidValues(preset.Size, collections);
      let sizeVal;
      if (fluid) {
        sizeVal = generateClamp(fluid.mobilePx, fluid.desktopPx, CONFIG.viewportBounds.min, CONFIG.viewportBounds.max);
      } else {
        const raw = resolveReference(preset.Size.$value, preset.Size.$collectionName || '_Alias', collections);
        sizeVal = typeof raw === 'number' ? pxToRem(raw) : raw;
      }
      tokens.push({ figmaCollection: collectionName, figmaPath: `${presetName}/Size`, cssProperty: `--text-${presetName}`, cssValue: sizeVal, valueType: fluid ? 'fluid' : 'dimension', tier: 'semantic', category: 'typography' });
    }
    if (preset.Line) {
      const fluid = resolveFluidValues(preset.Line, collections);
      let lineVal;
      if (fluid) {
        lineVal = generateClamp(fluid.mobilePx, fluid.desktopPx, CONFIG.viewportBounds.min, CONFIG.viewportBounds.max);
      } else {
        const raw = resolveReference(preset.Line.$value, preset.Line.$collectionName || '_Alias', collections);
        lineVal = typeof raw === 'number' ? pxToRem(raw) : raw;
      }
      tokens.push({ figmaCollection: collectionName, figmaPath: `${presetName}/Line`, cssProperty: `--text-${presetName}--line-height`, cssValue: lineVal, valueType: fluid ? 'fluid' : 'dimension', tier: 'semantic', category: 'typography' });
    }
    if (preset.Letter) {
      const letterVal = resolveReference(preset.Letter.$value, preset.Letter.$collectionName || '_Alias', collections);
      const letterEm = typeof letterVal === 'number' ? letterSpacingToEm(letterVal) : letterVal;
      tokens.push({ figmaCollection: collectionName, figmaPath: `${presetName}/Letter`, cssProperty: `--text-${presetName}--letter-spacing`, cssValue: letterEm, valueType: 'string', tier: 'semantic', category: 'typography' });
    }
    if (preset.Style) {
      const styleVal = resolveReference(preset.Style.$value, preset.Style.$collectionName || '_Alias', collections);
      const weight = FONT_WEIGHT_MAP[styleVal] || 400;
      tokens.push({ figmaCollection: collectionName, figmaPath: `${presetName}/Style`, cssProperty: `--text-${presetName}--font-weight`, cssValue: `${weight}`, valueType: 'string', tier: 'semantic', category: 'typography' });
    }
  }

  for (const [category, variants] of Object.entries(typoModeData)) {
    if (category.startsWith('$')) continue;
    for (const [variant, sizes] of Object.entries(variants)) {
      if (variant.startsWith('$')) continue;
      if (sizes.Font || sizes.Style || sizes.Size) {
        const presetName = `${toKebab(category)}-${toKebab(variant)}`;
        collectTypoPreset(presetName, sizes, typoInfo.name);
        continue;
      }
      for (const [size, preset] of Object.entries(sizes)) {
        if (size.startsWith('$')) continue;
        if (!preset.Font && !preset.Style && !preset.Size) continue;
        const presetName = `${toKebab(category)}-${toKebab(variant)}-${toKebab(size)}`;
        collectTypoPreset(presetName, preset, typoInfo.name);
      }
    }
  }

  // ─── Tier: semantic-color — light mode (semantic-inline.css) ─────────────────

  for (const collectionInfo of getSemanticColorCollections(collections)) {
    const modePair = getLightDarkModes(collectionInfo.collection);
    if (!modePair) continue;
    for (const entry of flattenTree(modePair.lightMode)) {
      const semanticName = buildSemanticColorName(entry.path);
      const cssRef = buildColorValueRef(entry.node, collections);
      tokens.push({
        figmaCollection: collectionInfo.name,
        figmaPath: entry.path.join('/'),
        cssProperty: `--semantic-${semanticName}`,
        cssValue: cssRef,
        valueType: 'color',
        tier: 'semantic-color',
        category: 'color',
      });
    }
  }

  return tokens;
}

// ─── Markdown formatter ───────────────────────────────────────────────────────

function formatMarkdownTable(tokens) {
  const lines = [
    '# Token Mapping\n\n',
    `> Generated: ${new Date().toISOString()}\n`,
    `> Total tokens: ${tokens.length}\n\n`,
    '| # | Figma Collection | Figma Path | CSS Property | CSS Value | Value Type | Tier | Category |\n',
    '|---|---|---|---|---|---|---|---|\n',
  ];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Truncate long values for readability
    const val = t.cssValue.length > 60 ? t.cssValue.slice(0, 57) + '...' : t.cssValue;
    lines.push(`| ${i + 1} | ${t.figmaCollection} | ${t.figmaPath} | \`${t.cssProperty}\` | \`${val}\` | ${t.valueType} | ${t.tier} | ${t.category} |\n`);
  }
  return lines.join('');
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Reading Figma JSON…');
  const raw = await readFile(CONFIG.sourcePath, 'utf-8');
  const json = JSON.parse(raw);

  console.log('Normalising collections…');
  const normalised = normaliseInputCollections(json);
  const collections = parseCollections(normalised);
  console.log(`Loaded ${collections.size} collections.`);

  console.log('Collecting token mappings…');
  const tokens = collectAllTokenMappings(collections);
  console.log(`Collected ${tokens.length} tokens.`);

  const outputJson = {
    generated: new Date().toISOString(),
    totalTokens: tokens.length,
    tokens,
  };

  const outputJsonPath = join(__dirname, 'token-mapping.json');
  const outputMdPath = join(__dirname, 'token-mapping.md');

  await writeFile(outputJsonPath, JSON.stringify(outputJson, null, 2), 'utf-8');
  console.log(`Wrote ${outputJsonPath}`);

  await writeFile(outputMdPath, formatMarkdownTable(tokens), 'utf-8');
  console.log(`Wrote ${outputMdPath}`);

  // Print summary by tier and category
  const byCat = {};
  for (const t of tokens) {
    const key = `${t.tier}/${t.category}`;
    byCat[key] = (byCat[key] || 0) + 1;
  }
  console.log('\nBreakdown by tier/category:');
  for (const [key, count] of Object.entries(byCat).sort()) {
    console.log(`  ${key}: ${count}`);
  }
  console.log(`\nTotal: ${tokens.length} tokens`);
}

main().catch(err => { console.error(err); process.exit(1); });
