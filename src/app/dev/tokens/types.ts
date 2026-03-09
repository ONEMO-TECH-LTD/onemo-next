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
