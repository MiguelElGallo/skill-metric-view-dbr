import { createInterface } from "node:readline";
import { isAbsolute } from "node:path";

import { readYamlFile } from "./io.js";
import { CHECKER_VERSION, type CheckOptions, type ComputeTarget } from "./types.js";
import { validateMetricViewYaml } from "./validator.js";

type JsonObject = Record<string, unknown>;

const SUPPORTED_PROTOCOLS = new Set([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
]);
const LATEST_PROTOCOL = "2025-11-25";
const TOOL_NAME = "check_databricks_metric_view_yaml";

const toolDefinition = {
  name: TOOL_NAME,
  title: "Check Databricks metric-view YAML",
  description:
    "Run fast local YAML 1.2, structure, cross-field, and optional runtime-compatibility checks before Databricks submission. Optional semantic-quality suggestions report metadata gaps without changing validity. A local pass does not validate business meaning, SQL expressions, catalog objects, permissions, data, or cardinality.",
  inputSchema: {
    type: "object",
    properties: {
      yaml: { type: "string", description: "Metric-view YAML text to check." },
      file: {
        type: "string",
        description: "Absolute local YAML file path to check instead of passing text.",
      },
      compute: {
        type: "string",
        enum: ["sql-warehouse", "dbr"],
        description: "Optional compatibility target.",
      },
      runtime_version: {
        type: "string",
        description: "Optional Databricks Runtime version such as 18.2; implies compute=dbr.",
      },
      allow_unknown_fields: {
        type: "boolean",
        default: false,
        description: "Downgrade checker-unsupported fields to warnings after documentation review.",
      },
      semantic_quality: {
        type: "boolean",
        default: false,
        description:
          "Add non-blocking suggestions for semantic metadata presence and deterministic synonym hygiene.",
      },
    },
    additionalProperties: false,
    oneOf: [{ required: ["yaml"] }, { required: ["file"] }],
  },
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(id: unknown, result: unknown): JsonObject {
  return { jsonrpc: "2.0", id, result };
}

function error(id: unknown, code: number, message: string): JsonObject {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function write(message: JsonObject): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function validateToolArguments(value: unknown): JsonObject {
  if (!isObject(value)) throw new Error("Tool arguments must be an object");
  const allowed = new Set([
    "yaml",
    "file",
    "compute",
    "runtime_version",
    "allow_unknown_fields",
    "semantic_quality",
  ]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new Error(`Unknown tool arguments: ${unknown.join(", ")}`);
  const hasYaml = typeof value.yaml === "string" && value.yaml.length > 0;
  const hasFile = typeof value.file === "string" && value.file.length > 0;
  if (hasYaml === hasFile) throw new Error("Provide exactly one of yaml or file");
  if (hasFile && !isAbsolute(value.file as string)) {
    throw new Error("file must be an absolute path because the plugin runs from its installation directory");
  }
  if (value.compute !== undefined && value.compute !== "sql-warehouse" && value.compute !== "dbr") {
    throw new Error("compute must be sql-warehouse or dbr");
  }
  if (value.runtime_version !== undefined && typeof value.runtime_version !== "string") {
    throw new Error("runtime_version must be a string");
  }
  if (value.allow_unknown_fields !== undefined && typeof value.allow_unknown_fields !== "boolean") {
    throw new Error("allow_unknown_fields must be a boolean");
  }
  if (value.semantic_quality !== undefined && typeof value.semantic_quality !== "boolean") {
    throw new Error("semantic_quality must be a boolean");
  }
  if (value.compute === "sql-warehouse" && value.runtime_version !== undefined) {
    throw new Error("runtime_version cannot be combined with compute=sql-warehouse");
  }
  return value;
}

async function callTool(argumentsValue: unknown): Promise<JsonObject> {
  const args = validateToolArguments(argumentsValue);
  const yaml = typeof args.yaml === "string" ? args.yaml : await readYamlFile(args.file as string);
  const runtimeVersion = typeof args.runtime_version === "string" ? args.runtime_version : undefined;
  const compute =
    (args.compute as ComputeTarget | undefined) ?? (runtimeVersion ? ("dbr" as const) : undefined);
  const options: CheckOptions = {
    ...(compute ? { compute } : {}),
    ...(runtimeVersion ? { runtimeVersion } : {}),
    ...(args.allow_unknown_fields === true ? { allowUnknownFields: true } : {}),
    ...(args.semantic_quality === true ? { semanticQuality: true } : {}),
    sourceName: typeof args.file === "string" ? args.file : "<tool-input>",
  };
  const result = validateMetricViewYaml(yaml, options);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
    isError: false,
  };
}

async function handle(message: JsonObject): Promise<JsonObject | undefined> {
  const id = message.id;
  const method = message.method;
  if (method === "initialize") {
    const params = isObject(message.params) ? message.params : {};
    const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : LATEST_PROTOCOL;
    return response(id, {
      protocolVersion: SUPPORTED_PROTOCOLS.has(requested) ? requested : LATEST_PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "databricks-metric-view-checker", version: CHECKER_VERSION },
    });
  }
  if (
    method === "notifications/initialized" ||
    (typeof method === "string" && method.startsWith("notifications/"))
  ) {
    return undefined;
  }
  if (method === "ping") return response(id, {});
  if (method === "tools/list") return response(id, { tools: [toolDefinition] });
  if (method === "tools/call") {
    const params = isObject(message.params) ? message.params : {};
    if (params.name !== TOOL_NAME) return error(id, -32601, `Unknown tool: ${String(params.name)}`);
    try {
      return response(id, await callTool(params.arguments));
    } catch (cause) {
      return error(id, -32602, cause instanceof Error ? cause.message : String(cause));
    }
  }
  return error(id, -32601, `Method not found: ${String(method)}`);
}

export async function runMcpServer(): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let outgoing: JsonObject | undefined;
    try {
      const incoming: unknown = JSON.parse(line);
      if (!isObject(incoming)) throw new Error("Request must be a JSON object");
      outgoing = await handle(incoming);
    } catch (cause) {
      outgoing = error(null, -32700, cause instanceof Error ? cause.message : String(cause));
    }
    if (outgoing) write(outgoing);
  }
}
