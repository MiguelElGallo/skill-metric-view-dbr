import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { normalizedTextSha256 } from "../scripts/provenance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("portable package and generated client catalogs validate", () => {
  const run = spawnSync(process.execPath, [join(root, "scripts", "validate-package.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.match(run.stdout, /structurally valid/);
});

test("provenance text hashes are stable across LF and CRLF checkouts", () => {
  assert.equal(normalizedTextSha256("first\nsecond\n"), normalizedTextSha256("first\r\nsecond\r\n"));
});
