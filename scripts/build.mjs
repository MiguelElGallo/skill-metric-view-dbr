import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "plugins", "databricks-metric-view", "dist", "checker.mjs");
const check = process.argv.includes("--check");
const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const temporary = await mkdtemp(join(tmpdir(), "metric-view-checker-build-"));
const output = check ? join(temporary, "checker.mjs") : destination;

try {
  await mkdir(dirname(output), { recursive: true });
  const result = await build({
    entryPoints: [join(root, "src", "entry.ts")],
    outfile: output,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    banner: {
      js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
    },
    legalComments: "none",
    metafile: true,
    sourcemap: false,
    logLevel: "warning",
  });
  const unexpectedExternals = Object.values(result.metafile.outputs)
    .flatMap((entry) => entry.imports)
    .filter((entry) => entry.external && !builtins.has(entry.path));
  if (unexpectedExternals.length > 0) {
    throw new Error(
      `Bundle has unexpected runtime dependencies: ${unexpectedExternals.map((entry) => entry.path).join(", ")}`,
    );
  }
  if (check) {
    const [actual, expected] = await Promise.all([readFile(destination), readFile(output)]);
    if (!actual.equals(expected)) {
      throw new Error("Bundled checker is stale; run npm run build and commit the result");
    }
    process.stdout.write("Bundled checker is reproducible and current\n");
  } else {
    const bytes = await readFile(output);
    await writeFile(destination, bytes);
    process.stdout.write(`Built ${destination} (${bytes.byteLength} bytes)\n`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
