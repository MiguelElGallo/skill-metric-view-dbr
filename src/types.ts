export const CHECKER_VERSION = "0.0.1";
export const RULES_VERIFIED_ON = "2026-08-29";

export type Severity = "error" | "warning" | "info";
export type ComputeTarget = "sql-warehouse" | "dbr";

export interface CheckOptions {
  allowUnknownFields?: boolean;
  compute?: ComputeTarget;
  runtimeVersion?: string;
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
  };
  valid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  diagnostics: Diagnostic[];
  disclaimer: string;
}
