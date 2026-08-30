import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "databricks-metric-view");

test("copied package with spaces exposes and invokes the MCP tool", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "metric plugin ü "));
  const isolated = join(temporary, "package with spaces");
  await cp(pluginRoot, isolated, { recursive: true });
  const yaml = await readFile(join(root, "tests", "fixtures", "valid", "basic-fields.yml"), "utf8");
  const invalidYaml = await readFile(
    join(root, "tests", "fixtures", "invalid", "duplicate-key.yml"),
    "utf8",
  );
  const mcp = JSON.parse(await readFile(join(isolated, "mcp.json"), "utf8"));
  const declared = mcp.mcpServers["databricks-metric-view-checker"];
  const expand = (value) => value.replaceAll("${PLUGIN_ROOT}", isolated);
  assert.match(declared.command, /^\.\//, "bundled MCP commands must be plugin-relative");
  const resolvedCommand = join(isolated, declared.command.slice(2));
  const expandedArgs = declared.args.map(expand);
  const environment = { ...process.env, PLUGIN_ROOT: isolated };
  environment.DATABRICKS_METRIC_VIEW_SKIP_SYSTEM_NODE = "1";
  environment.DATABRICKS_METRIC_VIEW_NODE =
    process.platform === "win32" ? join(isolated, "mcp.json") : "/bin/false";
  environment.DATABRICKS_METRIC_VIEW_HOST_RUNTIME = process.execPath;
  if (process.platform !== "win32") environment.PATH = "/usr/bin:/bin";
  const transport = new StdioClientTransport({
    command: resolvedCommand,
    args: expandedArgs,
    cwd: expand(declared.cwd),
    env: environment,
    stderr: "pipe",
  });
  const client = new Client({ name: "acceptance-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name), ["check_databricks_metric_view_yaml"]);
    const [checkerTool] = tools.tools;
    assert.equal(
      Object.hasOwn(checkerTool.inputSchema, "oneOf"),
      false,
      "VS Code Copilot rejects MCP tools with a top-level oneOf schema",
    );
    assert.equal(checkerTool.inputSchema.properties.semantic_quality.type, "boolean");
    assert.match(checkerTool.inputSchema.description, /exactly one of yaml or file/i);
    const call = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: { yaml, compute: "sql-warehouse", semantic_quality: true },
    });
    assert.equal(call.isError, false);
    assert.equal(call.structuredContent.valid, true);
    assert.deepEqual(call.structuredContent.context, {
      compute: "sql-warehouse",
      runtimeVersion: null,
      allowUnknownFields: false,
      semanticQuality: true,
    });
    assert.equal(
      call.structuredContent.diagnostics.some(
        (item) => item.category === "semantic-quality" && item.severity === "info",
      ),
      true,
    );
    assert.match(call.structuredContent.disclaimer, /not validated/);

    const fileCall = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: {
        file: join(root, "tests", "fixtures", "valid", "basic-dimensions-01.yml"),
      },
    });
    assert.equal(fileCall.isError, false);
    assert.equal(fileCall.structuredContent.valid, true);
    assert.equal(Object.hasOwn(fileCall.structuredContent.context, "semanticQuality"), false);
    assert.equal(
      fileCall.structuredContent.diagnostics.some(
        (item) => item.category === "semantic-quality",
      ),
      false,
    );

    const invalidCall = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: { yaml: invalidYaml },
    });
    assert.equal(invalidCall.isError, false);
    assert.equal(invalidCall.structuredContent.valid, false);
    assert.equal(invalidCall.structuredContent.errorCount >= 1, true);
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

test("VS Code compatibility package launches the portable MCP checker", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "metric vscode plugin ü "));
  const vscodeRoot = join(temporary, "standalone package with spaces");
  await cp(join(root, "plugins", "databricks-metric-view-vscode"), vscodeRoot, {
    recursive: true,
  });
  const manifest = JSON.parse(await readFile(join(vscodeRoot, "plugin.json"), "utf8"));
  assert.equal(manifest.mcpServers, "./.mcp.json");
  const mcp = JSON.parse(await readFile(join(vscodeRoot, ".mcp.json"), "utf8"));
  const declared = mcp.mcpServers["databricks-metric-view-checker"];
  const expand = (value) => value.replaceAll("${PLUGIN_ROOT}", vscodeRoot);
  const yaml = await readFile(join(root, "tests", "fixtures", "valid", "basic-fields.yml"), "utf8");
  const environment = { ...process.env, PLUGIN_ROOT: vscodeRoot };
  environment.DATABRICKS_METRIC_VIEW_SKIP_SYSTEM_NODE = "1";
  environment.DATABRICKS_METRIC_VIEW_NODE =
    process.platform === "win32" ? join(vscodeRoot, "plugin.json") : "/bin/false";
  environment.DATABRICKS_METRIC_VIEW_HOST_RUNTIME = process.execPath;
  if (process.platform !== "win32") environment.PATH = "/usr/bin:/bin";
  const transport = new StdioClientTransport({
    command: join(vscodeRoot, declared.command.slice(2)),
    args: declared.args.map(expand),
    cwd: expand(declared.cwd),
    env: environment,
    stderr: "pipe",
  });
  const client = new Client({ name: "vscode-compatibility-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map((tool) => tool.name), ["check_databricks_metric_view_yaml"]);
    const [checkerTool] = tools.tools;
    assert.deepEqual(Object.keys(checkerTool.inputSchema).sort(), [
      "additionalProperties",
      "description",
      "properties",
      "type",
    ]);
    assert.equal(checkerTool.inputSchema.properties.semantic_quality.type, "boolean");
    const call = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: { yaml, compute: "sql-warehouse", semantic_quality: true },
    });
    assert.equal(call.isError, false);
    assert.equal(call.structuredContent.valid, true);
    assert.equal(call.structuredContent.checkerVersion, "0.0.4");
    assert.equal(call.structuredContent.context.semanticQuality, true);
    assert.equal(
      call.structuredContent.diagnostics.some((item) => item.category === "semantic-quality"),
      true,
    );
  } finally {
    await client.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
