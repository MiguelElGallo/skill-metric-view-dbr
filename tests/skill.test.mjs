import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillPath = join(
  root,
  "plugins",
  "databricks-metric-view",
  "skills",
  "databricks-metric-view",
  "SKILL.md",
);

test("skill activation description has positive and negative boundaries", async () => {
  const skill = await readFile(skillPath, "utf8");
  const description = /^description:\s*(.+)$/m.exec(skill)?.[1] ?? "";
  for (const positive of ["Databricks Unity Catalog", "metric-view YAML", "WITH METRICS"]) {
    assert.match(description, new RegExp(positive, "i"));
  }
  for (const negative of ["Snowflake semantic views", "dbt semantic models", "databricks.yml"]) {
    assert.match(description, new RegExp(negative, "i"));
  }
});

test("skill preserves local and Databricks analyzer proof boundaries", async () => {
  const skill = await readFile(skillPath, "utf8");
  assert.match(skill, /Never summarize local-only success as “Databricks-valid.”/);
  assert.match(skill, /Do not create or replace the final metric view unless requested/);
  assert.match(skill, /If neither MCP nor CLI runs.*do not silently replace it with visual inspection/s);
});
