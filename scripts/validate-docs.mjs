import { access, readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = join(root, "docs");
const sections = ["tutorials", "how-to", "reference", "explanation"];

async function markdownFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const child = join(path, entry.name);
      if (entry.isDirectory()) return markdownFiles(child);
      return extname(entry.name) === ".md" ? [child] : [];
    }),
  );
  return nested.flat();
}

for (const section of sections) {
  const files = await markdownFiles(join(docsRoot, section));
  if (files.length < 2) throw new Error(`docs/${section} must contain at least two focused pages`);
}

const files = [join(root, "README.md"), ...(await markdownFiles(docsRoot))];
const missing = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  if (source.includes("0.1.0")) throw new Error(`Stale version 0.1.0 in ${file}`);

  const links = source.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g);
  for (const match of links) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1);
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    target = decodeURIComponent(target.split("#", 1)[0]);
    if (!target) continue;
    const resolved = resolve(dirname(file), target);
    try {
      await access(resolved);
    } catch {
      missing.push(`${file}: ${target}`);
    }
  }
}

if (missing.length > 0) throw new Error(`Broken local documentation links:\n${missing.join("\n")}`);
process.stdout.write(`Documentation is structured and ${files.length} Markdown files have valid local links\n`);
