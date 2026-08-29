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
  assert.match(skill, /Do not create, alter, replace, or drop the final metric view unless requested/);
  assert.match(skill, /If neither MCP nor CLI runs.*do not silently replace it with visual inspection/s);
});

test("skill makes semantic discovery evidence-based and privacy-bounded", async () => {
  const skill = await readFile(skillPath, "utf8");
  const discovery = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "semantic-discovery.md",
    ),
    "utf8",
  );

  assert.match(skill, /Do not generate a broad metric view from column names alone/);
  assert.match(skill, /discover-schema.*sample rows, null counts, and a total row count/s);
  assert.match(skill, /Query history.*need explicit scope/s);
  assert.match(discovery, /Business-authoritative[\s\S]*Governed[\s\S]*Observed[\s\S]*Inferred/);
  assert.match(discovery, /Sample only with authorization/);
  assert.match(discovery, /maximum profiling-query count/);
  assert.match(discovery, /source grain/i);
  assert.match(discovery, /one_to_many[\s\S]*bridge source/s);
  assert.match(discovery, /rely\.at_most_one_match.*sampled evidence alone/s);
});

test("skill includes executable and failure-aware live discovery operations", async () => {
  const liveOperations = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "live-discovery-operations.md",
    ),
    "utf8",
  );

  assert.match(liveOperations, /auth describe --profile <PROFILE>/);
  assert.match(liveOperations, /Statement Execution API/);
  assert.match(liveOperations, /on_wait_timeout: "CANCEL"/);
  assert.match(liveOperations, /SHOW CREATE TABLE[\s\S]*RELY/s);
  assert.match(liveOperations, /table_type = 'METRIC_VIEW'/);
  assert.match(liveOperations, /lakeview get-published/);
  assert.match(liveOperations, /genie get-space/);
  assert.match(liveOperations, /Never turn a failed or empty fetch into negative evidence/);
});

test("skill updates existing views without silently resetting grants", async () => {
  const skill = await readFile(skillPath, "utf8");
  const deployment = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "deployment.md",
    ),
    "utf8",
  );

  assert.match(skill, /ALTER VIEW.*grants and object identity/s);
  assert.match(deployment, /ALTER VIEW.*preserves grants and `table_id`/s);
  assert.match(
    deployment,
    /CREATE OR REPLACE.*explicitly accepts.*does not preserve.*grants.*`table_id`/s,
  );
});
