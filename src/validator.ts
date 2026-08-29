import { LineCounter, parseAllDocuments, type Document } from "yaml";

import {
  CHECKER_VERSION,
  RULES_VERIFIED_ON,
  type CheckOptions,
  type Diagnostic,
  type Severity,
  type ValidationResult,
} from "./types.js";

type PathPart = string | number;
type JsonObject = Record<string, unknown>;

const YAML_DOCS =
  "https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference";
const FEATURE_DOCS =
  "https://docs.databricks.com/gcp/en/uc-semantics/metric-views/feature-availability";
const METADATA_DOCS = "https://docs.databricks.com/aws/en/uc-semantics/agent-metadata";
const MATERIALIZATION_DOCS =
  "https://docs.databricks.com/aws/en/uc-semantics/metric-views/materialization";

const TOP_LEVEL_FIELDS = new Set([
  "version",
  "comment",
  "source",
  "parameters",
  "filter",
  "joins",
  "fields",
  "dimensions",
  "measures",
  "materialization",
]);

const FIELD_KEYS = new Set(["name", "expr", "comment", "display_name", "format", "synonyms"]);
const MEASURE_KEYS = new Set([...FIELD_KEYS, "window"]);
const JOIN_KEYS = new Set(["name", "source", "on", "using", "cardinality", "joins", "rely"]);
const PARAMETER_KEYS = new Set(["name", "data_type", "default"]);
const WINDOW_KEYS = new Set(["order", "range", "semiadditive", "offset"]);

const WILDCARD_EXPRESSION = /^(?:`[^`]+`|[A-Za-z_][\w$]*)(?:\.(?:`[^`]+`|[A-Za-z_][\w$]*))*\.\*(?:\s+EXCEPT\s*\(\s*(?:`[^`]+`|[A-Za-z_][\w$]*)(?:\s*,\s*(?:`[^`]+`|[A-Za-z_][\w$]*))*\s*\))?$/i;
const WILDCARD_PREFIX = /^(?:`[^`]+`|[A-Za-z_][\w$]*)(?:\.(?:`[^`]+`|[A-Za-z_][\w$]*))*\.\*/i;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatPath(path: PathPart[]): string {
  if (path.length === 0) return "$";
  return `$${path
    .map((part) => (typeof part === "number" ? `[${part}]` : /^[A-Za-z_]\w*$/.test(part) ? `.${part}` : `[${JSON.stringify(part)}]`))
    .join("")}`;
}

function parseRuntime(value: string | undefined): [number, number] | undefined {
  if (!value) return undefined;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return undefined;
  const major = Number(match[1]);
  // Unified releases start with DBR 18. A bare unified release follows every
  // historical point release in that major line; pre-18 bare versions remain .0.
  const minor = match[2] === undefined ? (major >= 18 ? Number.POSITIVE_INFINITY : 0) : Number(match[2]);
  return [major, minor];
}

function runtimeLessThan(actual: [number, number], minimum: string): boolean {
  const expected = parseRuntime(minimum);
  if (!expected) return false;
  return actual[0] < expected[0] || (actual[0] === expected[0] && actual[1] < expected[1]);
}

class ValidationContext {
  readonly diagnostics: Diagnostic[] = [];
  readonly runtime: [number, number] | undefined;
  version: "0.1" | "1.1" | undefined;
  readonly explicitOutputNames = new Map<string, PathPart[]>();
  readonly fieldExpressions = new Map<string, string>();
  readonly parameterTypes = new Map<string, string>();
  hasWildcardFields = false;
  hasWildcardMeasures = false;

  constructor(
    readonly document: Document.Parsed,
    readonly lineCounter: LineCounter,
    readonly options: CheckOptions,
  ) {
    this.runtime = parseRuntime(options.runtimeVersion);
  }

  add(
    code: string,
    severity: Severity,
    path: PathPart[],
    message: string,
    extras: { suggestion?: string; docsUrl?: string } = {},
  ): void {
    let nodePath = path;
    let node = this.document.getIn(nodePath, true) as { range?: [number, number, number] } | undefined;
    while (!node?.range && nodePath.length > 0) {
      nodePath = nodePath.slice(0, -1);
      node = this.document.getIn(nodePath, true) as { range?: [number, number, number] } | undefined;
    }
    const position = this.lineCounter.linePos(node?.range?.[0] ?? 0);
    this.diagnostics.push({
      code,
      severity,
      path: formatPath(path),
      line: position.line,
      column: position.col,
      message,
      ...(extras.suggestion ? { suggestion: extras.suggestion } : {}),
      ...(extras.docsUrl ? { docsUrl: extras.docsUrl } : {}),
      checkLevel: "local",
    });
  }

  unknownFields(value: JsonObject, allowed: Set<string>, path: PathPart[]): void {
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        this.add(
          "UNSUPPORTED_FIELD",
          this.options.allowUnknownFields ? "warning" : "error",
          [...path, key],
          `Field ${JSON.stringify(key)} is not supported by checker ${CHECKER_VERSION}; this does not prove that a newer Databricks release rejects it.`,
          {
            suggestion: this.options.allowUnknownFields
              ? "Verify the field against current Databricks documentation."
              : "Correct a possible typo, update the checker, or rerun with --allow-unknown after reviewing current Databricks documentation.",
            docsUrl: YAML_DOCS,
          },
        );
      }
    }
  }

  feature(
    path: PathPart[],
    featureName: string,
    minimumRuntime: string,
    options: { yaml11?: boolean; docsUrl?: string } = {},
  ): void {
    if (options.yaml11 && this.version !== "1.1") {
      this.add(
        "YAML_SPEC_FEATURE_MISMATCH",
        "error",
        path,
        `${featureName} requires metric-view YAML specification 1.1.`,
        { suggestion: "Set version: 1.1 or remove the feature.", docsUrl: options.docsUrl ?? FEATURE_DOCS },
      );
    }
    if (this.options.compute === "sql-warehouse") {
      this.add(
        "SQL_WAREHOUSE_FEATURE_CONTEXT",
        "info",
        path,
        `${featureName} requires Databricks Runtime ${minimumRuntime}+ on clusters; SQL warehouses use an automatically updated Databricks SQL version.`,
        { docsUrl: options.docsUrl ?? FEATURE_DOCS },
      );
      return;
    }
    if (this.runtime) {
      if (runtimeLessThan(this.runtime, minimumRuntime)) {
        this.add(
          "DATABRICKS_RUNTIME_TOO_OLD",
          "error",
          path,
          `${featureName} requires Databricks Runtime ${minimumRuntime}+; target runtime is ${this.options.runtimeVersion}.`,
          { docsUrl: options.docsUrl ?? FEATURE_DOCS },
        );
      }
      return;
    }
    this.add(
      "RUNTIME_REQUIREMENT_NOT_CHECKED",
      "info",
      path,
      `${featureName} requires Databricks Runtime ${minimumRuntime}+ when using cluster compute; no cluster runtime was supplied.`,
      { docsUrl: options.docsUrl ?? FEATURE_DOCS },
    );
  }
}

function requireObject(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  label: string,
): JsonObject | undefined {
  if (!isObject(value)) {
    ctx.add("TYPE_OBJECT_REQUIRED", "error", path, `${label} must be a YAML mapping.`, {
      docsUrl: YAML_DOCS,
    });
    return undefined;
  }
  return value;
}

function requireArray(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  label: string,
  nonEmpty = true,
): unknown[] | undefined {
  if (!Array.isArray(value)) {
    ctx.add("TYPE_ARRAY_REQUIRED", "error", path, `${label} must be a YAML sequence.`, {
      docsUrl: YAML_DOCS,
    });
    return undefined;
  }
  if (nonEmpty && value.length === 0) {
    ctx.add("EMPTY_SEQUENCE", "error", path, `${label} must contain at least one entry.`, {
      docsUrl: YAML_DOCS,
    });
  }
  return value;
}

function requireString(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  label: string,
): string | undefined {
  if (!nonBlank(value)) {
    ctx.add("NONEMPTY_STRING_REQUIRED", "error", path, `${label} must be a non-empty string.`, {
      docsUrl: YAML_DOCS,
    });
    return undefined;
  }
  return value;
}

function stringList(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  label: string,
  nonEmpty = true,
): string[] | undefined {
  const entries = requireArray(ctx, value, path, label, nonEmpty);
  if (!entries) return undefined;
  const strings: string[] = [];
  entries.forEach((entry, index) => {
    const item = requireString(ctx, entry, [...path, index], `${label} entry`);
    if (item) strings.push(item);
  });
  return strings;
}

function validateMetadata(
  ctx: ValidationContext,
  item: JsonObject,
  path: PathPart[],
): void {
  const metadataKeys = ["comment", "display_name", "format", "synonyms"].filter((key) =>
    Object.hasOwn(item, key),
  );
  if (metadataKeys.length > 0) {
    ctx.feature([...path, metadataKeys[0]!], "Agent metadata", "17.3", {
      yaml11: true,
      docsUrl: METADATA_DOCS,
    });
  }
  if (Object.hasOwn(item, "comment")) {
    requireString(ctx, item.comment, [...path, "comment"], "comment");
  }
  if (Object.hasOwn(item, "display_name")) {
    const displayName = requireString(
      ctx,
      item.display_name,
      [...path, "display_name"],
      "display_name",
    );
    if (displayName && displayName.length > 255) {
      ctx.add(
        "DISPLAY_NAME_TOO_LONG",
        "error",
        [...path, "display_name"],
        "display_name must be at most 255 characters.",
        { docsUrl: METADATA_DOCS },
      );
    }
  }
  if (Object.hasOwn(item, "synonyms")) {
    const synonyms = stringList(ctx, item.synonyms, [...path, "synonyms"], "synonyms", false);
    if (synonyms && synonyms.length > 10) {
      ctx.add(
        "TOO_MANY_SYNONYMS",
        "error",
        [...path, "synonyms"],
        "A field or measure can have at most 10 synonyms.",
        { docsUrl: METADATA_DOCS },
      );
    }
    synonyms?.forEach((synonym, index) => {
      if (synonym.length > 255) {
        ctx.add(
          "SYNONYM_TOO_LONG",
          "error",
          [...path, "synonyms", index],
          "Each synonym must be at most 255 characters.",
          { docsUrl: METADATA_DOCS },
        );
      }
    });
  }
  if (Object.hasOwn(item, "format")) validateFormat(ctx, item.format, [...path, "format"]);
}

function validateDecimalPlaces(ctx: ValidationContext, value: unknown, path: PathPart[]): void {
  const decimal = requireObject(ctx, value, path, "decimal_places");
  if (!decimal) return;
  ctx.unknownFields(decimal, new Set(["type", "places"]), path);
  const type = requireString(ctx, decimal.type, [...path, "type"], "decimal_places.type");
  if (type && !["max", "exact", "all"].includes(type)) {
    ctx.add(
      "INVALID_DECIMAL_PLACES_TYPE",
      "error",
      [...path, "type"],
      "decimal_places.type must be max, exact, or all.",
      { docsUrl: METADATA_DOCS },
    );
  }
  if (type === "max" || type === "exact") {
    if (!Number.isInteger(decimal.places) || (decimal.places as number) < 0 || (decimal.places as number) > 10) {
      ctx.add(
        "INVALID_DECIMAL_PLACES",
        "error",
        [...path, "places"],
        "decimal_places.places must be an integer from 0 through 10 for max or exact.",
        { docsUrl: METADATA_DOCS },
      );
    }
  } else if (type === "all" && Object.hasOwn(decimal, "places")) {
    ctx.add(
      "UNEXPECTED_DECIMAL_PLACES",
      "error",
      [...path, "places"],
      "decimal_places.places is not used when type is all.",
      { docsUrl: METADATA_DOCS },
    );
  }
}

function validateFormat(ctx: ValidationContext, value: unknown, path: PathPart[]): void {
  const format = requireObject(ctx, value, path, "format");
  if (!format) return;
  const type = requireString(ctx, format.type, [...path, "type"], "format.type");
  const commonNumeric = new Set(["type", "decimal_places", "hide_group_separator", "abbreviation"]);
  const allowedByType: Record<string, Set<string>> = {
    number: commonNumeric,
    currency: new Set([...commonNumeric, "currency_code"]),
    percentage: new Set(["type", "decimal_places", "hide_group_separator"]),
    byte: new Set(["type", "decimal_places", "hide_group_separator"]),
    date: new Set(["type", "date_format", "leading_zeros"]),
    date_time: new Set(["type", "date_format", "time_format", "leading_zeros"]),
  };
  if (!type || !Object.hasOwn(allowedByType, type)) {
    if (type) {
      ctx.add(
        "INVALID_FORMAT_TYPE",
        "error",
        [...path, "type"],
        "format.type must be number, currency, percentage, byte, date, or date_time.",
        { docsUrl: METADATA_DOCS },
      );
    }
    return;
  }
  ctx.unknownFields(format, allowedByType[type]!, path);
  if (Object.hasOwn(format, "decimal_places")) {
    validateDecimalPlaces(ctx, format.decimal_places, [...path, "decimal_places"]);
  }
  if (Object.hasOwn(format, "hide_group_separator") && typeof format.hide_group_separator !== "boolean") {
    ctx.add(
      "BOOLEAN_REQUIRED",
      "error",
      [...path, "hide_group_separator"],
      "hide_group_separator must be true or false.",
      { docsUrl: METADATA_DOCS },
    );
  }
  if (Object.hasOwn(format, "leading_zeros") && typeof format.leading_zeros !== "boolean") {
    ctx.add(
      "BOOLEAN_REQUIRED",
      "error",
      [...path, "leading_zeros"],
      "leading_zeros must be true or false.",
      { docsUrl: METADATA_DOCS },
    );
  }
  if (Object.hasOwn(format, "abbreviation")) {
    const abbreviation = requireString(
      ctx,
      format.abbreviation,
      [...path, "abbreviation"],
      "abbreviation",
    );
    if (abbreviation && !["none", "compact", "scientific"].includes(abbreviation)) {
      ctx.add(
        "INVALID_ABBREVIATION",
        "error",
        [...path, "abbreviation"],
        "abbreviation must be none, compact, or scientific.",
        { docsUrl: METADATA_DOCS },
      );
    }
  }
  if (type === "currency") {
    const code = requireString(
      ctx,
      format.currency_code,
      [...path, "currency_code"],
      "currency_code",
    );
    if (code && !/^[A-Z]{3}$/.test(code)) {
      ctx.add(
        "INVALID_CURRENCY_CODE_SHAPE",
        "error",
        [...path, "currency_code"],
        "currency_code must be a three-letter uppercase ISO-4217 code.",
        { docsUrl: METADATA_DOCS },
      );
    }
  }
  const dateFormats = [
    "no_date",
    "locale_short_month",
    "locale_long_month",
    "year_month_day",
    "locale_number_month",
    "year_week",
  ];
  const timeFormats = ["no_time", "locale_hour_minute", "locale_hour_minute_second"];
  if (Object.hasOwn(format, "date_format")) {
    const dateFormat = requireString(
      ctx,
      format.date_format,
      [...path, "date_format"],
      "date_format",
    );
    if (dateFormat && !dateFormats.includes(dateFormat)) {
      ctx.add("INVALID_DATE_FORMAT", "error", [...path, "date_format"], "Unsupported date_format value.", {
        docsUrl: METADATA_DOCS,
      });
    }
  }
  if (Object.hasOwn(format, "time_format")) {
    const timeFormat = requireString(
      ctx,
      format.time_format,
      [...path, "time_format"],
      "time_format",
    );
    if (timeFormat && !timeFormats.includes(timeFormat)) {
      ctx.add("INVALID_TIME_FORMAT", "error", [...path, "time_format"], "Unsupported time_format value.", {
        docsUrl: METADATA_DOCS,
      });
    }
  }
  if (type === "date") {
    if (!Object.hasOwn(format, "date_format")) {
      ctx.add(
        "DATE_FORMAT_REQUIRED",
        "error",
        [...path, "date_format"],
        "date format requires date_format.",
        { docsUrl: METADATA_DOCS },
      );
    } else if (format.date_format === "no_date") {
      ctx.add(
        "DATE_FORMAT_CANNOT_HIDE_DATE",
        "error",
        [...path, "date_format"],
        "no_date is supported only for date_time format.",
        { docsUrl: METADATA_DOCS },
      );
    }
  }
  if (type === "date_time") {
    if (!Object.hasOwn(format, "date_format")) {
      ctx.add(
        "DATETIME_DATE_FORMAT_REQUIRED",
        "error",
        [...path, "date_format"],
        "date_time format requires date_format.",
        { docsUrl: METADATA_DOCS },
      );
    }
    if (!Object.hasOwn(format, "time_format")) {
      ctx.add(
        "DATETIME_TIME_FORMAT_REQUIRED",
        "error",
        [...path, "time_format"],
        "date_time format requires time_format.",
        { docsUrl: METADATA_DOCS },
      );
    }
  }
  if (
    type === "date_time" &&
    (!Object.hasOwn(format, "date_format") || format.date_format === "no_date") &&
    (!Object.hasOwn(format, "time_format") || format.time_format === "no_time")
  ) {
    ctx.add(
      "DATETIME_FORMAT_HIDES_ALL",
      "error",
      path,
      "date_time format must show at least a date or a time.",
      { docsUrl: METADATA_DOCS },
    );
  }
}

function registerOutputName(
  ctx: ValidationContext,
  name: string,
  path: PathPart[],
  kind: "field" | "measure",
): void {
  const key = name.toLocaleLowerCase("en-US");
  const previous = ctx.explicitOutputNames.get(key);
  if (previous) {
    ctx.add(
      "DUPLICATE_OUTPUT_NAME",
      "error",
      path,
      `${kind} name ${JSON.stringify(name)} duplicates another explicit metric-view column name.`,
      { suggestion: `Use a unique name; first definition is at ${formatPath(previous)}.`, docsUrl: YAML_DOCS },
    );
  } else {
    ctx.explicitOutputNames.set(key, path);
  }
}

function isWildcardExpression(expression: string): boolean {
  return WILDCARD_EXPRESSION.test(expression.trim());
}

function validateWindow(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
): void {
  const windows = requireArray(ctx, value, path, "window");
  if (!windows) return;
  windows.forEach((entry, index) => {
    const itemPath = [...path, index];
    const window = requireObject(ctx, entry, itemPath, "window entry");
    if (!window) return;
    ctx.unknownFields(window, WINDOW_KEYS, itemPath);
    const order = requireString(ctx, window.order, [...itemPath, "order"], "window.order");
    const range = requireString(ctx, window.range, [...itemPath, "range"], "window.range");
    const semiadditive = requireString(
      ctx,
      window.semiadditive,
      [...itemPath, "semiadditive"],
      "window.semiadditive",
    );
    if (semiadditive && !["first", "last"].includes(semiadditive)) {
      ctx.add(
        "INVALID_SEMIADDITIVE",
        "error",
        [...itemPath, "semiadditive"],
        "window.semiadditive must be first or last.",
        { docsUrl: YAML_DOCS },
      );
    }
    if (order) {
      const field = ctx.fieldExpressions.get(order.toLocaleLowerCase("en-US"));
      if (!field && !ctx.hasWildcardFields) {
        ctx.add(
          "UNKNOWN_WINDOW_ORDER_FIELD",
          "error",
          [...itemPath, "order"],
          `window.order references unknown explicit field ${JSON.stringify(order)}.`,
          { docsUrl: YAML_DOCS },
        );
      } else if (!field && ctx.hasWildcardFields) {
        ctx.add(
          "WINDOW_ORDER_FIELD_UNVERIFIED",
          "warning",
          [...itemPath, "order"],
          `window.order ${JSON.stringify(order)} might be supplied by a wildcard; source columns were not inspected.`,
          { docsUrl: YAML_DOCS },
        );
      } else if (field && /\b(?:rand|uuid|current_timestamp)\s*\(/i.test(field)) {
        ctx.add(
          "NONDETERMINISTIC_WINDOW_ORDER",
          "warning",
          [...itemPath, "order"],
          "The ordering field appears non-deterministic, which can produce unpredictable window results.",
          { docsUrl: YAML_DOCS },
        );
      }
    }
    if (range) {
      const simple = /^(?:current|cumulative|all)$/i.test(range);
      const directional = /^(?:trailing|leading)\s+([^\s]+)(?:\s+(day|days|month|months|year|years))?(?:\s+(inclusive|exclusive))?$/i.exec(range);
      if (!simple && !directional) {
        ctx.add(
          "INVALID_WINDOW_RANGE_SHAPE",
          "error",
          [...itemPath, "range"],
          "window.range must be current, cumulative, all, or trailing/leading <value> <unit> with an optional inclusive/exclusive modifier.",
          { docsUrl: YAML_DOCS },
        );
      }
      if (directional) {
        const magnitude = directional[1]!;
        const unit = directional[2];
        const modifier = directional[3];
        if (!unit) {
          ctx.feature([...itemPath, "range"], "Unitless numeric-index window ranges", "19", {
            yaml11: true,
          });
          ctx.add(
            "NUMERIC_INDEX_DATA_NOT_VALIDATED",
            "warning",
            [...itemPath, "range"],
            "The ordering field must be an integral, dense, monotonic index at the intended comparison grain; source data was not inspected.",
            { docsUrl: YAML_DOCS },
          );
        }
        if (modifier) {
          ctx.feature([...itemPath, "range"], "Inclusive/exclusive window ranges", "18.1", {
            yaml11: true,
          });
        }
        if (/^[+-]?\d+$/.test(magnitude)) {
          if (Number(magnitude) <= 0) {
            ctx.add(
              "INVALID_WINDOW_RANGE_MAGNITUDE",
              "error",
              [...itemPath, "range"],
              "A literal window range magnitude must be a positive integer.",
              { docsUrl: YAML_DOCS },
            );
          }
        } else {
          validateWindowParameter(ctx, magnitude, [...itemPath, "range"]);
        }
      }
    }
    if (Object.hasOwn(window, "offset")) {
      const offsetPath = [...itemPath, "offset"];
      const offset = window.offset;
      if (typeof offset === "number" && Number.isInteger(offset)) {
        ctx.feature(offsetPath, "Unitless numeric-index window offsets", "19", { yaml11: true });
        ctx.add(
          "NUMERIC_INDEX_DATA_NOT_VALIDATED",
          "warning",
          offsetPath,
          "A unitless offset requires an integral, dense, monotonic ordering index; source data was not inspected.",
          { docsUrl: YAML_DOCS },
        );
      } else if (nonBlank(offset)) {
        const dated = /^([^\s]+)\s+(day|days|month|months|year|years)$/i.exec(offset);
        if (dated) {
          ctx.feature(offsetPath, "Dated window offsets", "18.1", { yaml11: true });
          if (!/^[+-]?\d+$/.test(dated[1]!)) {
            validateWindowParameter(ctx, dated[1]!, offsetPath);
          }
        } else if (/^[+-]?\d+$/.test(offset)) {
          ctx.feature(offsetPath, "Unitless numeric-index window offsets", "19", { yaml11: true });
          ctx.add(
            "NUMERIC_INDEX_DATA_NOT_VALIDATED",
            "warning",
            offsetPath,
            "A unitless offset requires an integral, dense, monotonic ordering index; source data was not inspected.",
            { docsUrl: YAML_DOCS },
          );
        } else if (/^[A-Za-z_][\w$]*$/.test(offset)) {
          ctx.feature(offsetPath, "Unitless numeric-index window offsets", "19", { yaml11: true });
          validateWindowParameter(ctx, offset, offsetPath);
          ctx.add(
            "NUMERIC_INDEX_DATA_NOT_VALIDATED",
            "warning",
            offsetPath,
            "A unitless offset requires an integral, dense, monotonic ordering index; source data was not inspected.",
            { docsUrl: YAML_DOCS },
          );
        } else {
          ctx.add(
            "INVALID_WINDOW_OFFSET_SHAPE",
            "error",
            offsetPath,
            "window.offset must be a signed integer, an integral parameter, or either followed by day(s), month(s), or year(s).",
            { docsUrl: YAML_DOCS },
          );
        }
      } else {
        ctx.add(
          "INVALID_WINDOW_OFFSET_SHAPE",
          "error",
          offsetPath,
          "window.offset must be a signed integer or non-empty offset string.",
          { docsUrl: YAML_DOCS },
        );
      }
    }
  });
}

function validateWindowParameter(ctx: ValidationContext, name: string, path: PathPart[]): void {
  ctx.feature(path, "Parameterized window size", "18.2");
  const type = ctx.parameterTypes.get(name.toLocaleLowerCase("en-US"));
  if (!type) {
    ctx.add(
      "UNKNOWN_WINDOW_PARAMETER",
      "error",
      path,
      `Window magnitude references unknown parameter ${JSON.stringify(name)}.`,
      { docsUrl: YAML_DOCS },
    );
    return;
  }
  if (!/^(?:tinyint|smallint|int|integer|bigint|byte|short|long)$/i.test(type)) {
    ctx.add(
      "NONINTEGRAL_WINDOW_PARAMETER",
      "error",
      path,
      `Window parameter ${JSON.stringify(name)} must use an integral data_type.`,
      { docsUrl: YAML_DOCS },
    );
  }
  if (/^(?:current|cumulative|all|trailing|leading|day|days|month|months|year|years|inclusive|exclusive|offset)$/i.test(name)) {
    ctx.add(
      "RESERVED_WINDOW_PARAMETER_NAME",
      "error",
      path,
      `Parameter ${JSON.stringify(name)} conflicts with a window keyword when used as a window magnitude.`,
      { docsUrl: YAML_DOCS },
    );
  }
}

function validateColumns(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  kind: "field" | "measure",
): void {
  const entries = requireArray(ctx, value, path, kind === "field" ? "fields/dimensions" : "measures");
  if (!entries) return;
  entries.forEach((entry, index) => {
    const itemPath = [...path, index];
    const item = requireObject(ctx, entry, itemPath, `${kind} entry`);
    if (!item) return;
    ctx.unknownFields(item, kind === "field" ? FIELD_KEYS : MEASURE_KEYS, itemPath);
    const expression = requireString(ctx, item.expr, [...itemPath, "expr"], `${kind}.expr`);
    if (!expression) return;
    const wildcard = isWildcardExpression(expression);
    if (!wildcard && WILDCARD_PREFIX.test(expression.trim())) {
      ctx.add(
        "INVALID_WILDCARD_EXPRESSION",
        "error",
        [...itemPath, "expr"],
        "Wildcard EXCEPT must contain a non-empty comma-separated list of column identifiers.",
        { docsUrl: YAML_DOCS },
      );
      return;
    }
    if (wildcard) {
      if (kind === "field") ctx.hasWildcardFields = true;
      else ctx.hasWildcardMeasures = true;
      ctx.feature([...itemPath, "expr"], "Wildcard imports", "18.2", { yaml11: true });
      const extraKeys = Object.keys(item).filter((key) => key !== "expr");
      if (extraKeys.length > 0) {
        ctx.add(
          "WILDCARD_ENTRY_HAS_EXTRA_FIELDS",
          "error",
          itemPath,
          `A wildcard ${kind} entry can contain only expr; remove ${extraKeys.join(", ")}.`,
          { docsUrl: YAML_DOCS },
        );
      }
      if (kind === "measure") {
        ctx.add(
          "MEASURE_WILDCARD_SOURCE_UNVERIFIED",
          "warning",
          [...itemPath, "expr"],
          "A measure wildcard imports measures only from a metric-view source; the source asset type was not checked locally.",
          { docsUrl: YAML_DOCS },
        );
      }
      return;
    }
    const name = requireString(ctx, item.name, [...itemPath, "name"], `${kind}.name`);
    if (name) {
      registerOutputName(ctx, name, [...itemPath, "name"], kind);
      if (kind === "field") ctx.fieldExpressions.set(name.toLocaleLowerCase("en-US"), expression);
    }
    validateMetadata(ctx, item, itemPath);
    if (kind === "measure" && Object.hasOwn(item, "window")) {
      validateWindow(ctx, item.window, [...itemPath, "window"]);
    }
  });
}

function validateParameters(ctx: ValidationContext, value: unknown, path: PathPart[]): void {
  ctx.feature(path, "Parameters", "18.2");
  const parameters = requireArray(ctx, value, path, "parameters");
  if (!parameters) return;
  let defaultsStarted = false;
  const names = new Map<string, PathPart[]>();
  parameters.forEach((entry, index) => {
    const itemPath = [...path, index];
    const parameter = requireObject(ctx, entry, itemPath, "parameter entry");
    if (!parameter) return;
    ctx.unknownFields(parameter, PARAMETER_KEYS, itemPath);
    const name = requireString(ctx, parameter.name, [...itemPath, "name"], "parameter.name");
    const dataType = requireString(
      ctx,
      parameter.data_type,
      [...itemPath, "data_type"],
      "parameter.data_type",
    );
    if (name) {
      const key = name.toLocaleLowerCase("en-US");
      const previous = names.get(key);
      if (previous) {
        ctx.add(
          "DUPLICATE_PARAMETER_NAME",
          "error",
          [...itemPath, "name"],
          `Parameter ${JSON.stringify(name)} is duplicated.`,
          { suggestion: `First definition is at ${formatPath(previous)}.`, docsUrl: YAML_DOCS },
        );
      } else {
        names.set(key, [...itemPath, "name"]);
        if (dataType) ctx.parameterTypes.set(key, dataType);
      }
    }
    const hasDefault = Object.hasOwn(parameter, "default");
    if (defaultsStarted && !hasDefault) {
      ctx.add(
        "PARAMETER_DEFAULT_ORDER",
        "error",
        itemPath,
        "Every parameter after the first parameter with a default must also define default.",
        { docsUrl: YAML_DOCS },
      );
    }
    defaultsStarted ||= hasDefault;
  });
}

function validateJoins(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  parentCardinality?: "many_to_one" | "one_to_many",
): void {
  const joins = requireArray(ctx, value, path, "joins");
  if (!joins) return;
  const siblingNames = new Map<string, PathPart[]>();
  joins.forEach((entry, index) => {
    const itemPath = [...path, index];
    const join = requireObject(ctx, entry, itemPath, "join entry");
    if (!join) return;
    ctx.unknownFields(join, JOIN_KEYS, itemPath);
    const name = requireString(ctx, join.name, [...itemPath, "name"], "join.name");
    requireString(ctx, join.source, [...itemPath, "source"], "join.source");
    if (name) {
      const key = name.toLocaleLowerCase("en-US");
      const previous = siblingNames.get(key);
      if (previous) {
        ctx.add(
          "DUPLICATE_JOIN_ALIAS",
          "error",
          [...itemPath, "name"],
          `Join alias ${JSON.stringify(name)} duplicates a sibling alias.`,
          { suggestion: `First definition is at ${formatPath(previous)}.`, docsUrl: YAML_DOCS },
        );
      } else siblingNames.set(key, [...itemPath, "name"]);
    }
    const hasOn = Object.hasOwn(join, "on");
    const hasUsing = Object.hasOwn(join, "using");
    if (hasOn === hasUsing) {
      ctx.add(
        "JOIN_CONDITION_EXCLUSIVE",
        "error",
        itemPath,
        "A join must define exactly one of on or using.",
        { docsUrl: YAML_DOCS },
      );
    }
    if (hasOn) requireString(ctx, join.on, [...itemPath, "on"], "join.on");
    if (hasUsing) stringList(ctx, join.using, [...itemPath, "using"], "join.using");
    let cardinality: "many_to_one" | "one_to_many" | undefined = "many_to_one";
    if (Object.hasOwn(join, "cardinality")) {
      const suppliedCardinality = requireString(
        ctx,
        join.cardinality,
        [...itemPath, "cardinality"],
        "join.cardinality",
      );
      ctx.feature([...itemPath, "cardinality"], "Join cardinality", "18.1", { yaml11: true });
      if (
        suppliedCardinality &&
        !["many_to_one", "one_to_many"].includes(suppliedCardinality)
      ) {
        ctx.add(
          "INVALID_JOIN_CARDINALITY",
          "error",
          [...itemPath, "cardinality"],
          "join.cardinality must be many_to_one or one_to_many.",
          { docsUrl: YAML_DOCS },
        );
        cardinality = undefined;
      } else if (suppliedCardinality) {
        cardinality = suppliedCardinality as "many_to_one" | "one_to_many";
      }
    }
    if (parentCardinality && cardinality && parentCardinality !== cardinality) {
      const parentIsOneToMany = parentCardinality === "one_to_many";
      ctx.add(
        parentIsOneToMany
          ? "ONE_TO_MANY_DESCENDANT_CARDINALITY"
          : "MANY_TO_ONE_DESCENDANT_CARDINALITY",
        "error",
        [...itemPath, "cardinality"],
        `Every join in this nested subtree must use cardinality: ${parentCardinality}. Top-level sibling branches may use different cardinalities.`,
        { docsUrl: YAML_DOCS },
      );
    }
    if (Object.hasOwn(join, "rely")) {
      ctx.feature([...itemPath, "rely"], "Join optimization with rely", "18.1");
      const rely = requireObject(ctx, join.rely, [...itemPath, "rely"], "join.rely");
      if (rely) {
        ctx.unknownFields(rely, new Set(["at_most_one_match"]), [...itemPath, "rely"]);
        if (
          Object.hasOwn(rely, "at_most_one_match") &&
          typeof rely.at_most_one_match !== "boolean"
        ) {
          ctx.add(
            "BOOLEAN_REQUIRED",
            "error",
            [...itemPath, "rely", "at_most_one_match"],
            "rely.at_most_one_match must be true or false.",
            { docsUrl: YAML_DOCS },
          );
        } else if (rely.at_most_one_match === true) {
          ctx.add(
            "JOIN_RELY_DATA_NOT_VALIDATED",
            "warning",
            [...itemPath, "rely", "at_most_one_match"],
            "Databricks does not validate this promise at runtime; duplicate matches can silently produce incorrect measures.",
            { docsUrl: YAML_DOCS },
          );
        }
      }
    }
    if (Object.hasOwn(join, "joins")) {
      ctx.feature([...itemPath, "joins"], "Snowflake-schema nested joins", "17.3");
      validateJoins(ctx, join.joins, [...itemPath, "joins"], cardinality);
    }
  });
}

function validateReferenceList(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
  label: string,
  known: Set<string>,
  hasWildcard: boolean,
): string[] | undefined {
  const references = stringList(ctx, value, path, label);
  const seen = new Set<string>();
  references?.forEach((reference, index) => {
    const key = reference.toLocaleLowerCase("en-US");
    if (seen.has(key)) {
      ctx.add(
        "DUPLICATE_MATERIALIZATION_REFERENCE",
        "error",
        [...path, index],
        `${label} repeats ${JSON.stringify(reference)}.`,
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
    seen.add(key);
    if (!known.has(key)) {
      ctx.add(
        "UNKNOWN_MATERIALIZATION_REFERENCE",
        hasWildcard ? "warning" : "error",
        [...path, index],
        hasWildcard
          ? `${JSON.stringify(reference)} is not an explicit output but might be supplied by a wildcard; source columns were not inspected.`
          : `${JSON.stringify(reference)} does not match an explicit metric-view output.`,
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
  });
  return references;
}

function validateClusterBy(ctx: ValidationContext, value: unknown, path: PathPart[]): void {
  const cluster = requireObject(ctx, value, path, "cluster_by");
  if (!cluster) return;
  ctx.unknownFields(cluster, new Set(["cols", "auto"]), path);
  const hasCols = Object.hasOwn(cluster, "cols");
  const hasAuto = Object.hasOwn(cluster, "auto");
  if (hasCols === hasAuto) {
    ctx.add(
      "CLUSTER_BY_EXCLUSIVE",
      "error",
      path,
      "cluster_by must define exactly one of cols or auto.",
      { docsUrl: MATERIALIZATION_DOCS },
    );
  }
  if (hasCols) stringList(ctx, cluster.cols, [...path, "cols"], "cluster_by.cols");
  if (hasAuto && cluster.auto !== true) {
    ctx.add(
      "CLUSTER_BY_AUTO_TRUE",
      "error",
      [...path, "auto"],
      "cluster_by.auto must be true when specified.",
      { docsUrl: MATERIALIZATION_DOCS },
    );
  }
}

function validateMaterialization(
  ctx: ValidationContext,
  value: unknown,
  path: PathPart[],
): void {
  ctx.feature(path, "Metric-view materialization", "17.3", { docsUrl: MATERIALIZATION_DOCS });
  const materialization = requireObject(ctx, value, path, "materialization");
  if (!materialization) return;
  ctx.unknownFields(materialization, new Set(["schedule", "mode", "materialized_views"]), path);
  if (Object.hasOwn(materialization, "schedule")) {
    const schedule = requireString(
      ctx,
      materialization.schedule,
      [...path, "schedule"],
      "materialization.schedule",
    );
    if (schedule && /TRIGGER\s+ON\s+UPDATE/i.test(schedule)) {
      ctx.add(
        "UNSUPPORTED_TRIGGER_ON_UPDATE",
        "error",
        [...path, "schedule"],
        "Metric-view materialization does not support TRIGGER ON UPDATE.",
        { docsUrl: MATERIALIZATION_DOCS },
      );
    } else if (schedule) {
      const every = /^every\s+(\d+)\s+(hours?|days?|weeks?)$/i.exec(schedule);
      const cron = /^cron\s+(['"])(.*?)\1(?:\s+at\s+time\s+zone\s+(['"])(.*?)\3)?$/i.exec(
        schedule,
      );
      if (every) {
        const interval = Number(every[1]);
        const unit = every[2]!.toLowerCase();
        const maximum = unit.startsWith("hour") ? 72 : unit.startsWith("day") ? 31 : 8;
        if (interval < 1 || interval > maximum) {
          ctx.add(
            "MATERIALIZATION_SCHEDULE_OUT_OF_RANGE",
            "error",
            [...path, "schedule"],
            `EVERY ${unit} interval must be between 1 and ${maximum}.`,
            { docsUrl: MATERIALIZATION_DOCS },
          );
        }
      } else if (cron) {
        const fields = cron[2]!.trim().split(/\s+/);
        if (fields.length !== 6) {
          ctx.add(
            "INVALID_MATERIALIZATION_CRON_FIELDS",
            "error",
            [...path, "schedule"],
            "A Quartz CRON schedule must contain six space-separated fields.",
            { docsUrl: MATERIALIZATION_DOCS },
          );
        } else {
          ctx.add(
            "MATERIALIZATION_CRON_ANALYZER_REQUIRED",
            "warning",
            [...path, "schedule"],
            "The CRON expression has six fields, but complete Quartz syntax and time-zone validity require Databricks analyzer validation.",
            { docsUrl: MATERIALIZATION_DOCS },
          );
        }
      } else {
        ctx.add(
          "INVALID_MATERIALIZATION_SCHEDULE",
          "error",
          [...path, "schedule"],
          "Schedule must be EVERY <number> HOURS|DAYS|WEEKS or CRON '<six-field Quartz expression>' with an optional quoted time zone.",
          { docsUrl: MATERIALIZATION_DOCS },
        );
      }
    }
  }
  const mode = requireString(ctx, materialization.mode, [...path, "mode"], "materialization.mode");
  if (mode && mode !== "relaxed") {
    ctx.add(
      "INVALID_MATERIALIZATION_MODE",
      "error",
      [...path, "mode"],
      "materialization.mode must be relaxed.",
      { docsUrl: MATERIALIZATION_DOCS },
    );
  }
  const views = requireArray(
    ctx,
    materialization.materialized_views,
    [...path, "materialized_views"],
    "materialization.materialized_views",
  );
  if (!views) return;
  const fieldNames = new Set(ctx.fieldExpressions.keys());
  const measureNames = new Set(
    [...ctx.explicitOutputNames.keys()].filter((name) => !ctx.fieldExpressions.has(name)),
  );
  const viewNames = new Map<string, PathPart[]>();
  let unaggregatedCount = 0;
  views.forEach((entry, index) => {
    const itemPath = [...path, "materialized_views", index];
    const view = requireObject(ctx, entry, itemPath, "materialized view entry");
    if (!view) return;
    ctx.unknownFields(
      view,
      new Set(["name", "type", "dimensions", "measures", "cluster_by", "partition_by"]),
      itemPath,
    );
    const name = requireString(ctx, view.name, [...itemPath, "name"], "materialized view name");
    if (name) {
      const key = name.toLocaleLowerCase("en-US");
      const previous = viewNames.get(key);
      if (previous) {
        ctx.add(
          "DUPLICATE_MATERIALIZATION_NAME",
          "error",
          [...itemPath, "name"],
          `Materialization name ${JSON.stringify(name)} is duplicated.`,
          { suggestion: `First definition is at ${formatPath(previous)}.`, docsUrl: MATERIALIZATION_DOCS },
        );
      } else viewNames.set(key, [...itemPath, "name"]);
    }
    const type = requireString(ctx, view.type, [...itemPath, "type"], "materialization type");
    if (type && !["aggregated", "unaggregated"].includes(type)) {
      ctx.add(
        "INVALID_MATERIALIZATION_TYPE",
        "error",
        [...itemPath, "type"],
        "Materialization type must be aggregated or unaggregated.",
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
    const hasDimensions = Object.hasOwn(view, "dimensions");
    const hasMeasures = Object.hasOwn(view, "measures");
    if (type === "aggregated" && !hasDimensions && !hasMeasures) {
      ctx.add(
        "AGGREGATED_MATERIALIZATION_EMPTY",
        "error",
        itemPath,
        "An aggregated materialization requires dimensions, measures, or both.",
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
    if (type === "unaggregated") {
      unaggregatedCount += 1;
      if (hasDimensions || hasMeasures) {
        ctx.add(
          "UNAGGREGATED_HAS_OUTPUT_LISTS",
          "error",
          itemPath,
          "An unaggregated materialization must not define dimensions or measures.",
          { docsUrl: MATERIALIZATION_DOCS },
        );
      }
    }
    if (hasDimensions) {
      validateReferenceList(
        ctx,
        view.dimensions,
        [...itemPath, "dimensions"],
        "materialization dimensions",
        fieldNames,
        ctx.hasWildcardFields,
      );
    }
    if (hasMeasures) {
      validateReferenceList(
        ctx,
        view.measures,
        [...itemPath, "measures"],
        "materialization measures",
        measureNames,
        ctx.hasWildcardMeasures,
      );
    }
    if (Object.hasOwn(view, "cluster_by")) {
      validateClusterBy(ctx, view.cluster_by, [...itemPath, "cluster_by"]);
    }
    if (Object.hasOwn(view, "partition_by")) {
      stringList(ctx, view.partition_by, [...itemPath, "partition_by"], "partition_by");
    }
  });
  if (unaggregatedCount > 1) {
    ctx.add(
      "MULTIPLE_UNAGGREGATED_MATERIALIZATIONS",
      "error",
      [...path, "materialized_views"],
      "Only one unaggregated materialization is allowed per metric view.",
      { docsUrl: MATERIALIZATION_DOCS },
    );
  }
}

function validateVersion(ctx: ValidationContext, root: JsonObject): void {
  if (!Object.hasOwn(root, "version")) {
    ctx.add("VERSION_REQUIRED", "error", ["version"], "version is required.", {
      suggestion: "Use version: 1.1 for current metric-view definitions.",
      docsUrl: FEATURE_DOCS,
    });
    return;
  }
  const node = ctx.document.get("version", true) as { source?: unknown } | undefined;
  const raw = node?.source === undefined ? String(root.version) : String(node.source);
  if (raw !== "0.1" && raw !== "1.1") {
    ctx.add(
      "UNSUPPORTED_YAML_SPEC_VERSION",
      "error",
      ["version"],
      `version must be exactly 0.1 or 1.1; found ${JSON.stringify(raw)}.`,
      { docsUrl: FEATURE_DOCS },
    );
    return;
  }
  ctx.version = raw;
}

function syntaxResult(
  diagnostics: Diagnostic[],
  options: CheckOptions,
): ValidationResult {
  const errors = diagnostics.filter((item) => item.severity === "error").length;
  const warnings = diagnostics.filter((item) => item.severity === "warning").length;
  const infos = diagnostics.filter((item) => item.severity === "info").length;
  return {
    checkerVersion: CHECKER_VERSION,
    rulesVerifiedOn: RULES_VERIFIED_ON,
    checkLevel: "local",
    source: options.sourceName ?? "<input>",
    context: {
      compute: options.compute ?? null,
      runtimeVersion: options.runtimeVersion ?? null,
      allowUnknownFields: options.allowUnknownFields ?? false,
    },
    valid: errors === 0,
    errorCount: errors,
    warningCount: warnings,
    infoCount: infos,
    diagnostics,
    disclaimer:
      errors === 0
        ? "Local checks passed; Databricks SQL expressions, catalog objects, permissions, source data, join cardinality, and analyzer behavior were not validated."
        : "Local checks failed; the definition was not submitted to Databricks. Databricks SQL expressions and catalog semantics were not validated.",
  };
}

export function validateMetricViewYaml(
  source: string,
  options: CheckOptions = {},
): ValidationResult {
  const lineCounter = new LineCounter();
  const documents = parseAllDocuments(source, {
    lineCounter,
    prettyErrors: false,
    uniqueKeys: true,
    version: "1.2",
  });
  const syntaxDiagnostics: Diagnostic[] = [];
  if (documents.length !== 1) {
    syntaxDiagnostics.push({
      code: "SINGLE_DOCUMENT_REQUIRED",
      severity: "error",
      path: "$",
      line: 1,
      column: 1,
      message: `A metric-view definition must contain exactly one YAML document; found ${documents.length}.`,
      suggestion: "Place each metric-view definition in a separate file.",
      docsUrl: YAML_DOCS,
      checkLevel: "local",
    });
  }
  for (const document of documents) {
    for (const error of document.errors) {
      const position = lineCounter.linePos(error.pos[0]);
      syntaxDiagnostics.push({
        code: error.code || "YAML_PARSE_ERROR",
        severity: "error",
        path: "$",
        line: position.line,
        column: position.col,
        message: error.message,
        docsUrl: YAML_DOCS,
        checkLevel: "local",
      });
    }
  }
  if (/^\s*<<\s*:/m.test(source)) {
    const offset = source.search(/^\s*<<\s*:/m);
    const position = lineCounter.linePos(Math.max(offset, 0));
    syntaxDiagnostics.push({
      code: "YAML_MERGE_KEY_UNSUPPORTED",
      severity: "error",
      path: "$",
      line: position.line,
      column: position.col,
      message: "YAML merge keys (<<) are not part of YAML 1.2 core and are not accepted by this checker.",
      docsUrl: YAML_DOCS,
      checkLevel: "local",
    });
  }
  if (syntaxDiagnostics.length > 0 || documents.length !== 1) {
    return syntaxResult(syntaxDiagnostics, options);
  }

  const document = documents[0]!;
  const context = new ValidationContext(document, lineCounter, options);
  let payload: unknown;
  try {
    payload = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    context.add(
      "YAML_CONSTRUCTION_ERROR",
      "error",
      [],
      error instanceof Error ? error.message : String(error),
      { docsUrl: YAML_DOCS },
    );
    return syntaxResult(context.diagnostics, options);
  }
  const root = requireObject(context, payload, [], "Metric-view document root");
  if (!root) return syntaxResult(context.diagnostics, options);
  context.unknownFields(root, TOP_LEVEL_FIELDS, []);
  validateVersion(context, root);
  requireString(context, root.source, ["source"], "source");

  if (context.options.compute === "dbr" && !context.options.runtimeVersion) {
    context.add(
      "RUNTIME_VERSION_REQUIRED",
      "error",
      [],
      "compute=dbr requires an explicit Databricks Runtime version for compatibility checking.",
      { suggestion: "Supply a version such as 17.3 or 18.2.", docsUrl: FEATURE_DOCS },
    );
  } else if (context.options.compute === "dbr" && !context.runtime) {
    context.add(
      "INVALID_RUNTIME_VERSION",
      "error",
      [],
      `Could not parse runtime version ${JSON.stringify(context.options.runtimeVersion)}.`,
      { suggestion: "Use a version such as 17.3 or 18.2.", docsUrl: FEATURE_DOCS },
    );
  }
  if (context.runtime && runtimeLessThan(context.runtime, "16.4")) {
    context.add(
      "METRIC_VIEWS_RUNTIME_TOO_OLD",
      "error",
      [],
      `Metric views require Databricks Runtime 16.4+; target runtime is ${context.options.runtimeVersion}.`,
      { docsUrl: FEATURE_DOCS },
    );
  }
  if (Object.hasOwn(root, "comment")) {
    validateMetadata(context, { comment: root.comment }, []);
  }
  if (Object.hasOwn(root, "filter")) {
    requireString(context, root.filter, ["filter"], "filter");
  }
  if (Object.hasOwn(root, "parameters")) validateParameters(context, root.parameters, ["parameters"]);
  if (Object.hasOwn(root, "joins")) validateJoins(context, root.joins, ["joins"]);

  const hasFields = Array.isArray(root.fields) && root.fields.length > 0;
  const hasDimensions = Array.isArray(root.dimensions) && root.dimensions.length > 0;
  const hasMeasures = Array.isArray(root.measures) && root.measures.length > 0;
  if (!hasFields && !hasDimensions && !hasMeasures) {
    context.add(
      "OUTPUT_DEFINITION_REQUIRED",
      "error",
      [],
      "Define at least one field/dimension or measure.",
      { docsUrl: YAML_DOCS },
    );
  }
  if (Object.hasOwn(root, "fields")) validateColumns(context, root.fields, ["fields"], "field");
  if (Object.hasOwn(root, "dimensions")) {
    validateColumns(context, root.dimensions, ["dimensions"], "field");
  }
  if (Object.hasOwn(root, "fields") && Object.hasOwn(root, "dimensions")) {
    context.add(
      "FIELDS_AND_DIMENSIONS_TOGETHER",
      "warning",
      [],
      "fields and dimensions are equivalent aliases; current documentation does not define simultaneous use clearly.",
      { suggestion: "Prefer fields for new definitions and use only one keyword.", docsUrl: YAML_DOCS },
    );
  }
  if (Object.hasOwn(root, "measures")) validateColumns(context, root.measures, ["measures"], "measure");
  if (Object.hasOwn(root, "materialization")) {
    validateMaterialization(context, root.materialization, ["materialization"]);
    if (Object.hasOwn(root, "parameters")) {
      context.add(
        "PARAMETERS_WITH_MATERIALIZATION",
        "error",
        ["materialization"],
        "A parameterized metric view cannot be materialized.",
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
    if (/\b(?:current_user|is_member|is_account_group_member)\s*\(/i.test(JSON.stringify(root))) {
      context.add(
        "INVOKER_DEPENDENT_MATERIALIZATION",
        "warning",
        ["materialization"],
        "The definition appears to use an invoker-dependent function, which is incompatible with materialization.",
        { docsUrl: MATERIALIZATION_DOCS },
      );
    }
  }

  return syntaxResult(context.diagnostics, options);
}
