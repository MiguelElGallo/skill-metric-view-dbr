import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const portableRoot = join(root, "plugins", "databricks-metric-view");
const vscodeRoot = join(root, "plugins", "databricks-metric-view-vscode");
const check = process.argv.includes("--check");
const temporary = await mkdtemp(join(tmpdir(), "metric-view-vscode-plugin-"));
const expectedRoot = join(temporary, "databricks-metric-view-vscode");

async function populate(target) {
  const portableManifest = JSON.parse(await readFile(join(portableRoot, "plugin.json"), "utf8"));
  delete portableManifest.$schema;
  portableManifest.skills = { paths: ["./skills"], exclusive: true };
  portableManifest.mcpServers = "./.mcp.json";

  await mkdir(target, { recursive: true });
  await writeFile(join(target, "plugin.json"), `${JSON.stringify(portableManifest, null, 2)}\n`);
  await cp(join(portableRoot, "mcp.json"), join(target, ".mcp.json"));
  for (const directory of ["bin", "dist", "licenses", "skills"]) {
    await cp(join(portableRoot, directory), join(target, directory), { recursive: true });
  }
  for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
    await cp(join(portableRoot, file), join(target, file));
  }
}

async function snapshot(directory) {
  const files = new Map();

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(current, entry.name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error(`Generated VS Code plugin must not contain symlinks: ${path}`);
      if (stat.isDirectory()) {
        await walk(path);
        continue;
      }
      const name = relative(directory, path).split(sep).join("/");
      const text = (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
      files.set(name, { text, executable: Boolean(stat.mode & 0o111) });
    }
  }

  await walk(directory);
  return files;
}

function equalSnapshots(actual, expected) {
  if (actual.size !== expected.size) return false;
  for (const [name, expectedFile] of expected) {
    const actualFile = actual.get(name);
    if (!actualFile || actualFile.text !== expectedFile.text) return false;
    if (process.platform !== "win32" && actualFile.executable !== expectedFile.executable) return false;
  }
  return true;
}

try {
  await populate(expectedRoot);
  if (check) {
    const [actual, expected] = await Promise.all([snapshot(vscodeRoot), snapshot(expectedRoot)]);
    if (!equalSnapshots(actual, expected)) {
      throw new Error("Generated VS Code compatibility plugin is stale; run npm run generate");
    }
    process.stdout.write("Generated VS Code compatibility plugin is current\n");
  } else {
    await rm(vscodeRoot, { recursive: true, force: true });
    await cp(expectedRoot, vscodeRoot, { recursive: true });
    process.stdout.write(`Generated ${vscodeRoot}\n`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
