import { resolve } from "node:path";

import { readStandardInput, readYamlFile } from "./io.js";
import type { CheckOptions, ComputeTarget, ValidationResult } from "./types.js";
import { validateMetricViewYaml } from "./validator.js";

const HELP = `Databricks metric-view YAML checker

Usage:
  checker.cmd check <file|-> [options]

Options:
  --format <text|json>              Output format (default: text)
  --compute <sql-warehouse|dbr>     Target compute compatibility context
  --runtime <major.minor>           DBR version; implies --compute dbr
  --allow-unknown                   Downgrade unsupported fields to warnings
  -h, --help                        Show this help

Exit codes: 0 local checks passed, 1 validation failed, 2 usage or I/O failure.
`;

interface ParsedArguments {
  file: string;
  format: "text" | "json";
  options: CheckOptions;
}

function usageError(message: string): never {
  throw new Error(`${message}\n\n${HELP}`);
}

function optionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) usageError(`${option} requires a value`);
  return value;
}

function parseArguments(args: string[]): ParsedArguments | undefined {
  if (args.includes("--help") || args.includes("-h")) return undefined;
  if (args[0] !== "check") usageError("Expected the check subcommand");
  const file = args[1];
  if (!file || file.startsWith("--")) usageError("check requires a YAML file path or - for stdin");
  let format: "text" | "json" = "text";
  let compute: ComputeTarget | undefined;
  let runtimeVersion: string | undefined;
  let allowUnknownFields = false;
  for (let index = 2; index < args.length; index += 1) {
    const argument = args[index]!;
    if (argument === "--format") {
      const value = optionValue(args, index, argument);
      if (value !== "text" && value !== "json") usageError("--format must be text or json");
      format = value;
      index += 1;
    } else if (argument === "--compute") {
      const value = optionValue(args, index, argument);
      if (value !== "sql-warehouse" && value !== "dbr") {
        usageError("--compute must be sql-warehouse or dbr");
      }
      compute = value;
      index += 1;
    } else if (argument === "--runtime") {
      runtimeVersion = optionValue(args, index, argument);
      index += 1;
    } else if (argument === "--allow-unknown") {
      allowUnknownFields = true;
    } else {
      usageError(`Unknown option: ${argument}`);
    }
  }
  if (runtimeVersion && compute === "sql-warehouse") {
    usageError("--runtime cannot be combined with --compute sql-warehouse");
  }
  compute ??= runtimeVersion ? "dbr" : undefined;
  const options: CheckOptions = {
    ...(compute ? { compute } : {}),
    ...(runtimeVersion ? { runtimeVersion } : {}),
    ...(allowUnknownFields ? { allowUnknownFields: true } : {}),
    sourceName: file === "-" ? "<stdin>" : resolve(file),
  };
  return { file, format, options };
}

function textResult(result: ValidationResult): string {
  const status = result.valid ? "PASS" : "FAIL";
  const lines = [
    `${status} ${result.source} (${result.errorCount} errors, ${result.warningCount} warnings, ${result.infoCount} info)`,
    `Context: compute=${result.context.compute ?? "unspecified"}, runtime=${result.context.runtimeVersion ?? "unspecified"}, allowUnknownFields=${result.context.allowUnknownFields}`,
  ];
  for (const diagnostic of result.diagnostics) {
    lines.push(
      `[${diagnostic.severity.toUpperCase()} ${diagnostic.code}] ${diagnostic.line}:${diagnostic.column} ${diagnostic.path} ${diagnostic.message}`,
    );
    if (diagnostic.suggestion) lines.push(`  Suggestion: ${diagnostic.suggestion}`);
  }
  lines.push(result.disclaimer);
  return `${lines.join("\n")}\n`;
}

export async function runCli(args: string[]): Promise<number> {
  const parsed = parseArguments(args);
  if (!parsed) {
    process.stdout.write(HELP);
    return 0;
  }
  const source = parsed.file === "-" ? await readStandardInput() : await readYamlFile(parsed.file);
  const result = validateMetricViewYaml(source, parsed.options);
  process.stdout.write(parsed.format === "json" ? `${JSON.stringify(result, null, 2)}\n` : textResult(result));
  return result.valid ? 0 : 1;
}

export function formatCliError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
