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

test("skill requires production semantic coverage without inventing terminology", async () => {
  const skill = await readFile(skillPath, "utf8");
  const authoring = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "authoring.md",
    ),
    "utf8",
  );
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

  assert.match(skill, /named columns and measures as required seeds, not an exhaustive/);
  assert.match(skill, /names a selected profile.*real assets/s);
  assert.match(skill, /`only` limits outputs; it never waives/);
  assert.match(skill, /word `minimal` alone does not select this route/);
  assert.match(skill, /complete metadata-only schema for every bounded source table/);
  assert.match(skill, /every source column as include, exclude, or defer/);
  assert.match(skill, /smallest semantically complete view/);
  assert.match(skill, /A request to deploy does not approve invented semantics/);
  assert.match(skill, /`use your best judgment`.*drafting proposals, not marking them approved/s);
  assert.match(skill, /keep it in the suggestion inventory and out of deployable YAML/s);
  assert.match(skill, /semantic_quality: true/);
  assert.match(authoring, /semantic readiness review/i);
  assert.match(authoring, /small view can be semantically complete/);
  assert.match(authoring, /before YAML for every production-intended real-asset creation/);
  assert.match(discovery, /Read existing table comments and every column comment before drafting descriptions/);
  assert.match(discovery, /value.*yaml_path.*evidence_class.*locator.*owner\/currentness.*status/s);
  assert.match(discovery, /A request to deploy is not approval to invent/);
});

test("skill preserves durable agent metadata and documents downstream propagation", async () => {
  const skill = await readFile(skillPath, "utf8");
  const vscodeSkill = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view-vscode",
      "skills",
      "databricks-metric-view",
      "SKILL.md",
    ),
    "utf8",
  );
  const yamlReference = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "yaml-reference.md",
    ),
    "utf8",
  );
  const vscodeYamlReference = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view-vscode",
      "skills",
      "databricks-metric-view",
      "references",
      "yaml-reference.md",
    ),
    "utf8",
  );

  assert.match(skill, /removes single-line YAML comments written with `#`/);
  assert.match(skill, /AI\/BI dashboards.*`display_name`.*`format`.*Genie.*`synonyms`/s);
  assert.match(yamlReference, /temporary authoring notes, not durable semantic metadata/);
  assert.match(yamlReference, /AI\/BI dashboards.*`display_name`.*`format`/s);
  assert.match(yamlReference, /Genie imports `synonyms`/);
  assert.equal(vscodeSkill, skill);
  assert.equal(vscodeYamlReference, yamlReference);
});

test("skill carries over relevant full Snowflake-skill workflow lessons", async () => {
  const skill = await readFile(skillPath, "utf8");
  const authoring = await readFile(
    join(
      root,
      "plugins",
      "databricks-metric-view",
      "skills",
      "databricks-metric-view",
      "references",
      "authoring.md",
    ),
    "utf8",
  );

  assert.match(skill, /reproduce the same question or query.*smallest semantic-layer gap/s);
  assert.match(skill, /retrieved customer metric-view definitions.*out of the repository/s);
  assert.match(skill, /Prefer explicit fields, comments, display names, synonyms, formats, measures, filters, and joins over broad AI instructions/);
  assert.match(authoring, /Keep trusted question\/SQL-pair changes separate from structural repairs/);
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

test("live deployment checks and preserves the exact submitted YAML", async () => {
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

  assert.match(skill, /read \[deployment\.md\].*before constructing or submitting any DDL/i);
  assert.match(skill, /exact YAML payload that will appear between `\$\$` delimiters/);
  assert.match(skill, /Submit one checked statement[\s\S]*rerun the local gate/s);
  assert.match(skill, /permission, ownership, target-state, context, transport, timeout, or unknown-outcome failures/);
  assert.match(skill, /bin\/checker\.cmd check/);
  assert.match(deployment, /WITH METRICS[\s\S]*LANGUAGE YAML[\s\S]*AS \$\$/s);
  assert.match(deployment, /Do not use `databricks experimental aitools tools query`/);
  assert.match(deployment, /Only a deterministic YAML or DDL parser\/analyzer error[\s\S]*rerun the local checker/s);
  assert.match(deployment, /DESCRIBE TABLE EXTENDED.*AS JSON[\s\S]*type is `METRIC_VIEW`[\s\S]*current principal owns it/s);
  assert.match(deployment, /CREATE VIEW `<catalog>`\.`<schema>`\.`<view>`/);
  assert.match(deployment, /catalog: \$catalog, schema: \$schema, statement: \./);
  assert.match(deployment, /compare the complete tree[\s\S]*materialization/s);
});
