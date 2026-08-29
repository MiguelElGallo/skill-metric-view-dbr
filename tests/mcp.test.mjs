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
    const call = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: { yaml, compute: "sql-warehouse" },
    });
    assert.equal(call.isError, false);
    assert.equal(call.structuredContent.valid, true);
    assert.deepEqual(call.structuredContent.context, {
      compute: "sql-warehouse",
      runtimeVersion: null,
      allowUnknownFields: false,
    });
    assert.match(call.structuredContent.disclaimer, /not validated/);

    const fileCall = await client.callTool({
      name: "check_databricks_metric_view_yaml",
      arguments: {
        file: join(root, "tests", "fixtures", "valid", "basic-dimensions-01.yml"),
      },
    });
    assert.equal(fileCall.isError, false);
    assert.equal(fileCall.structuredContent.valid, true);

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
