import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { parseDocument } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "databricks-metric-view");

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function assertNoSymlinks(path) {
  for (const name of await readdir(path)) {
    const child = join(path, name);
    const stat = await lstat(child);
    if (stat.isSymbolicLink()) throw new Error(`Plugin package must not contain symlinks: ${child}`);
    if (stat.isDirectory()) await assertNoSymlinks(child);
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const pluginSchema = await json(join(root, "schemas", "agent-plugins", "1.0.0", "plugin.schema.json"));
const mcpSchema = await json(join(root, "schemas", "agent-plugins", "1.0.0", "mcp.schema.json"));
const manifest = await json(join(pluginRoot, "plugin.json"));
const mcp = await json(join(pluginRoot, "mcp.json"));
const packageManifest = await json(join(root, "package.json"));
const catalog = await json(join(root, "catalog", "plugins.json"));

for (const [label, schema, value] of [
  ["plugin.json", pluginSchema, manifest],
  ["mcp.json", mcpSchema, mcp],
]) {
  const validate = ajv.compile(schema);
  if (!validate(value)) throw new Error(`${label} failed Agent Plugins schema: ${ajv.errorsText(validate.errors)}`);
}

if (manifest.name !== "databricks-metric-view") throw new Error("Plugin folder and manifest name differ");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("Plugin version must use strict semver");
const server = mcp.mcpServers["databricks-metric-view-checker"];
if (server.command !== "node") throw new Error("MCP runtime must use the cross-platform node command");
if (server.args[0] !== "${PLUGIN_ROOT}/dist/checker.mjs" || server.args[1] !== "mcp") {
  throw new Error("MCP args must address the bundled server through PLUGIN_ROOT");
}

const skillPath = join(pluginRoot, "skills", "databricks-metric-view", "SKILL.md");
const skillSource = await readFile(skillPath, "utf8");
const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skillSource);
if (!frontmatter) throw new Error("SKILL.md is missing YAML frontmatter");
const metadata = parseDocument(frontmatter[1], { uniqueKeys: true }).toJS();
if (metadata.name !== "databricks-metric-view") throw new Error("Skill folder and frontmatter name differ");
if (typeof metadata.description !== "string" || metadata.description.length < 40) {
  throw new Error("Skill description is missing or not discriminating");
}

await Promise.all([
  readFile(join(pluginRoot, "dist", "checker.mjs")),
  readFile(join(pluginRoot, "LICENSE")),
  readFile(join(pluginRoot, "THIRD_PARTY_NOTICES.md")),
]);
await assertNoSymlinks(pluginRoot);

const copilot = await json(join(root, ".github", "plugin", "marketplace.json"));
const codex = await json(join(root, ".agents", "plugins", "marketplace.json"));
const versions = new Set([
  packageManifest.version,
  manifest.version,
  catalog.marketplace.version,
  copilot.metadata?.version,
]);
if (versions.size !== 1 || !versions.has("0.0.1")) {
  throw new Error(`Package, plugin, catalog, and generated marketplace versions must all be 0.0.1: ${[...versions].join(", ")}`);
}
if (copilot.plugins[0]?.source !== "./plugins/databricks-metric-view") {
  throw new Error("Copilot marketplace source is incorrect");
}
if (codex.plugins[0]?.source?.path !== "./plugins/databricks-metric-view") {
  throw new Error("Codex marketplace source is incorrect");
}

process.stdout.write("Portable plugin and client marketplaces are structurally valid\n");
