export interface Token {
  figmaCollection: string;
  figmaPath: string;
  cssProperty: string;
  cssValue: string;
  valueType?: string;
  tier: string;
  category: string;
}

export interface TokenMapping {
  generated: string;
  totalTokens: number;
  tokens: Token[];
}

export interface ValidationCheck {
  id: string;
  category: string;
  status: "pass" | "fail" | "warn";
  details: string[];
}

export interface ValidationReport {
  timestamp: string;
  source: string;
  summary: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
  };
  checks: ValidationCheck[];
}

// ─── Pipeline V2 types ────────────────────────────────────────────────────────

export type StageStatus = 'pending' | 'running' | 'pass' | 'warn' | 'error' | 'saved';

export interface PipelineStage {
  id: 'input' | 'validate' | 'generate' | 'output';
  label: string;
  status: StageStatus;
  count?: number; // error/warning count
}

export interface BlueprintViolation {
  ruleId: string;
  severity: 'error' | 'warn' | 'info';
  segment: string;
  segmentIndex: number;
  description: string;
  suggestedFix: string;
}

export interface BlueprintTokenResult {
  tokenPath: string;
  collection: string;
  status: 'pass' | 'warn' | 'error' | 'info';
  violations: BlueprintViolation[];
}

export interface BlueprintReport {
  timestamp: string;
  source: string;
  summary: { total: number; pass: number; info: number; warn: number; error: number };
  results: BlueprintTokenResult[];
}

export interface SaveResult {
  name: string;
  path: string;
  files: { filename: string; bytes: number; written: boolean }[];
}
