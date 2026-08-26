// Compatibility entrypoint for the Step 2 contract split.
// Contracts live in class-contract.ts; registration lives in class-registry.ts.
export type {
  ClassControls,
  ClassSpec,
  ClassType,
  ClassVariant,
  DraftIdentity,
  DraftShape,
  LibraryClass,
  OutlineRecipe,
} from './class-contract'
