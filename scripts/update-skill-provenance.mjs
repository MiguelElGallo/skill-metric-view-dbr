import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizedTextFileSha256 } from "./provenance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(root, "plugins", "databricks-metric-view");
const skillRoot = join(pluginRoot, "skills", "databricks-metric-view");
const provenancePath = join(pluginRoot, "provenance", "databricks-metric-view.json");
const check = process.argv.includes("--check");

async function skillSnapshot() {
  const files = {};
  const fileModes = {};

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = join(current, entry.name);
      const stat = await lstat(child);
      if (stat.isSymbolicLink()) throw new Error(`Skill must not contain symlinks: ${child}`);
      if (stat.isDirectory()) {
        await walk(child);
        continue;
      }
      const name = relative(skillRoot, child).split(sep).join("/");
      files[name] = await normalizedTextFileSha256(child);
      fileModes[name] = Boolean(stat.mode & 0o111);
    }
  }

  await walk(skillRoot);
  const digest = createHash("sha256");
  for (const [path, value] of Object.entries(files).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    digest.update(path);
    digest.update("\0");
    digest.update(value);
    digest.update("\n");
  }
  return { files, fileModes, contentSha256: digest.digest("hex") };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const current = JSON.parse(await readFile(provenancePath, "utf8"));
const snapshot = await skillSnapshot();
const licenseSha256 = await normalizedTextFileSha256(
  join(pluginRoot, current.licenseEvidence.path),
);
const expected = {
  ...current,
  revision: `sha256:${snapshot.contentSha256}`,
  licenseEvidence: {
    ...current.licenseEvidence,
    sha256: licenseSha256,
  },
  contentSha256: snapshot.contentSha256,
  files: snapshot.files,
  fileModes: snapshot.fileModes,
};

if (check) {
  if (!same(current, expected)) {
    throw new Error("Skill provenance is stale; run npm run generate");
  }
  process.stdout.write("Skill provenance is current\n");
} else {
  await writeFile(provenancePath, `${JSON.stringify(expected, null, 2)}\n`);
  process.stdout.write(`Updated ${provenancePath}\n`);
}
