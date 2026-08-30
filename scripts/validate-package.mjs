import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { parseDocument } from "yaml";

import { normalizedTextFileSha256 } from "./provenance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "databricks-metric-view");
const vscodePluginRoot = join(root, "plugins", "databricks-metric-view-vscode");

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

async function skillHashes(path) {
  const hashes = {};
  const modes = {};

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = join(current, entry.name);
      const stat = await lstat(child);
      if (stat.isSymbolicLink()) throw new Error("Skill must not contain symlinks: " + child);
      if (stat.isDirectory()) {
        await walk(child);
        continue;
      }
      const name = relative(path, child).split(sep).join("/");
      hashes[name] = await normalizedTextFileSha256(child);
      modes[name] = Boolean(stat.mode & 0o111);
    }
  }

  await walk(path);
  return { hashes, modes };
}

function treeHash(hashes) {
  const digest = createHash("sha256");
  for (const [path, value] of Object.entries(hashes).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    digest.update(path);
    digest.update("\0");
    digest.update(value);
    digest.update("\n");
  }
  return digest.digest("hex");
}

function mapsEqual(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
  );
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const pluginSchema = await json(join(root, "schemas", "agent-plugins", "1.0.0", "plugin.schema.json"));
const mcpSchema = await json(join(root, "schemas", "agent-plugins", "1.0.0", "mcp.schema.json"));
const manifest = await json(join(pluginRoot, "plugin.json"));
const mcp = await json(join(pluginRoot, "mcp.json"));
const vscodeManifest = await json(join(vscodePluginRoot, "plugin.json"));
const vscodeMcp = await json(join(vscodePluginRoot, ".mcp.json"));
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
if (server.command !== "./bin/checker.cmd") {
  throw new Error("MCP runtime must use the bundled plugin-relative launcher");
}
if (server.args.length !== 1 || server.args[0] !== "mcp") {
  throw new Error("MCP launcher must receive only the mcp subcommand");
}
const launcher = await lstat(join(pluginRoot, "bin", "checker.cmd"));
if (process.platform !== "win32" && !(launcher.mode & 0o111)) {
  throw new Error("MCP launcher must be executable on POSIX systems");
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

const provenance = await json(
  join(pluginRoot, "provenance", "databricks-metric-view.json"),
);
const { hashes, modes } = await skillHashes(
  join(pluginRoot, "skills", "databricks-metric-view"),
);
const contentSha256 = treeHash(hashes);
if (
  !mapsEqual(provenance.files, hashes) ||
  !mapsEqual(provenance.fileModes, modes) ||
  provenance.contentSha256 !== contentSha256 ||
  provenance.revision !== "sha256:" + contentSha256
) {
  throw new Error("Skill provenance hashes or modes are stale");
}
const licenseSha256 = await normalizedTextFileSha256(
  join(pluginRoot, provenance.licenseEvidence.path),
);
if (provenance.licenseEvidence.sha256 !== licenseSha256) {
  throw new Error("Skill provenance license evidence is stale");
}

await Promise.all([
  readFile(join(pluginRoot, "bin", "checker.cmd")),
  readFile(join(pluginRoot, "bin", "checker.ps1")),
  readFile(join(pluginRoot, "bin", "checker.sh")),
  readFile(join(pluginRoot, "bin", "checker-windows.cmd")),
  readFile(join(pluginRoot, "dist", "checker.mjs")),
  readFile(join(pluginRoot, "LICENSE")),
  readFile(join(pluginRoot, "THIRD_PARTY_NOTICES.md")),
]);
await assertNoSymlinks(pluginRoot);
await assertNoSymlinks(vscodePluginRoot);

if (Object.hasOwn(vscodeManifest, "$schema")) {
  throw new Error("VS Code compatibility manifest must use the Copilot format");
}
for (const field of ["name", "version", "description"]) {
  if (vscodeManifest[field] !== manifest[field]) {
    throw new Error(`VS Code compatibility manifest ${field} differs from the portable plugin`);
  }
}
const vscodeSkills = vscodeManifest.skills;
if (
  vscodeSkills?.exclusive !== true ||
  vscodeSkills.paths?.length !== 1 ||
  vscodeSkills.paths[0] !== "./skills"
) {
  throw new Error("VS Code compatibility skill path must target its bundled skill copy");
}
if (vscodeManifest.mcpServers !== "./.mcp.json") {
  throw new Error("VS Code compatibility manifest must declare its bundled MCP configuration");
}
if (JSON.stringify(vscodeMcp) !== JSON.stringify(mcp)) {
  throw new Error("VS Code compatibility MCP configuration differs from the portable plugin");
}
const vscodeServer = vscodeMcp.mcpServers?.["databricks-metric-view-checker"];
if (
  vscodeServer?.type !== "stdio" ||
  vscodeServer.command !== "./bin/checker.cmd" ||
  vscodeServer.args?.length !== 1 ||
  vscodeServer.args[0] !== "mcp" ||
  vscodeServer.cwd !== "${PLUGIN_ROOT}"
) {
  throw new Error("VS Code compatibility MCP definition is stale");
}
const expandVscodeRoot = (value) => value.replaceAll("${PLUGIN_ROOT}", vscodePluginRoot);
if (resolve(expandVscodeRoot(vscodeServer.cwd), vscodeServer.command) !== join(vscodePluginRoot, "bin", "checker.cmd")) {
  throw new Error("VS Code compatibility MCP command does not resolve to its bundled launcher");
}

const copilot = await json(join(root, ".github", "plugin", "marketplace.json"));
const codex = await json(join(root, ".agents", "plugins", "marketplace.json"));
const versions = new Set([
  packageManifest.version,
  manifest.version,
  vscodeManifest.version,
  catalog.marketplace.version,
  copilot.metadata?.version,
]);
if (versions.size !== 1 || !versions.has("0.0.3")) {
  throw new Error(`Package, plugins, catalog, and generated marketplace versions must all be 0.0.3: ${[...versions].join(", ")}`);
}
if (copilot.plugins[0]?.source !== "./plugins/databricks-metric-view-vscode") {
  throw new Error("Copilot marketplace source is incorrect");
}
if (codex.plugins[0]?.source?.path !== "./plugins/databricks-metric-view") {
  throw new Error("Codex marketplace source is incorrect");
}

process.stdout.write("Portable plugin and client marketplaces are structurally valid\n");
