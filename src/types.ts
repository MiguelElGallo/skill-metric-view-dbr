export const CHECKER_VERSION = "0.0.4";
export const RULES_VERIFIED_ON = "2026-08-30";

export type Severity = "error" | "warning" | "info";
export type ComputeTarget = "sql-warehouse" | "dbr";

export interface CheckOptions {
  allowUnknownFields?: boolean;
  compute?: ComputeTarget;
  runtimeVersion?: string;
  semanticQuality?: boolean;
  sourceName?: string;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  path: string;
  line: number;
  column: number;
  message: string;
  suggestion?: string;
  docsUrl?: string;
  category?: "semantic-quality";
  checkLevel: "local";
}

export interface ValidationResult {
  checkerVersion: string;
  rulesVerifiedOn: string;
  checkLevel: "local";
  source: string;
  context: {
    compute: ComputeTarget | null;
    runtimeVersion: string | null;
    allowUnknownFields: boolean;
    semanticQuality?: true;
  };
  valid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  diagnostics: Diagnostic[];
  disclaimer: string;
}
