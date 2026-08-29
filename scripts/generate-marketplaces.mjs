import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(root, "catalog", "plugins.json"), "utf8"));
const check = process.argv.includes("--check");

const plugins = await Promise.all(
  catalog.plugins.map(async (entry) => ({
    entry,
    manifest: JSON.parse(
      await readFile(join(root, "plugins", entry.name, "plugin.json"), "utf8"),
    ),
  })),
);

const copilot = {
  name: catalog.marketplace.name,
  owner: catalog.marketplace.owner,
  metadata: {
    description: catalog.marketplace.description,
    version: catalog.marketplace.version,
  },
  plugins: plugins.map(({ manifest }) => ({
    name: manifest.name,
    description: manifest.description,
    version: manifest.version,
    source: `./plugins/${manifest.name}`,
  })),
};

const codex = {
  name: catalog.marketplace.name,
  interface: { displayName: catalog.marketplace.displayName },
  plugins: plugins
    .filter(({ entry }) => entry.codexCompatibility)
    .map(({ entry }) => ({
      name: entry.name,
      source: { source: "local", path: `./plugins/${entry.name}` },
      policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
      category: entry.category,
    })),
};

const rendered = new Map([
  [join(root, ".github", "plugin", "marketplace.json"), `${JSON.stringify(copilot, null, 2)}\n`],
  [join(root, ".agents", "plugins", "marketplace.json"), `${JSON.stringify(codex, null, 2)}\n`],
]);

for (const [path, content] of rendered) {
  if (check) {
    const current = await readFile(path, "utf8").catch(() => "");
    if (current !== content) throw new Error(`Generated marketplace is stale: ${path}`);
  } else {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    process.stdout.write(`Generated ${path}\n`);
  }
}

if (check) process.stdout.write("Generated marketplaces are current\n");
