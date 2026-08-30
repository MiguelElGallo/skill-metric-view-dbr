import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checker = join(root, "plugins", "databricks-metric-view", "dist", "checker.mjs");
const fixtures = join(root, "tests", "fixtures");

function check(file, ...args) {
  return spawnSync(process.execPath, [checker, "check", file, "--format", "json", ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function checkYaml(yaml, ...args) {
  return spawnSync(process.execPath, [checker, "check", "-", "--format", "json", ...args], {
    cwd: root,
    input: yaml,
    encoding: "utf8",
  });
}

function checkText(file, ...args) {
  return spawnSync(process.execPath, [checker, "check", file, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function result(run) {
  assert.equal(run.stderr, "");
  return JSON.parse(run.stdout);
}

test("canonical 1.1 fields and COUNT(*) pass without wildcard confusion", () => {
  const run = check(join(fixtures, "valid", "basic-fields.yml"), "--compute", "sql-warehouse");
  assert.equal(run.status, 0);
  const parsed = result(run);
  assert.equal(parsed.valid, true);
  assert.match(parsed.disclaimer, /SQL expressions.*not validated/);
  assert.equal(parsed.diagnostics.some((item) => item.code.includes("WILDCARD")), false);
  assert.equal(Object.hasOwn(parsed.context, "semanticQuality"), false);
  assert.equal(
    parsed.diagnostics.some((item) => item.category === "semantic-quality"),
    false,
  );
});

test("semantic-quality mode is opt-in, non-blocking, and reports metadata gaps", () => {
  const run = check(
    join(fixtures, "valid", "basic-fields.yml"),
    "--compute",
    "sql-warehouse",
    "--semantic-quality",
  );
  assert.equal(run.status, 0);
  const parsed = result(run);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.context.semanticQuality, true);
  const quality = parsed.diagnostics.filter((item) => item.category === "semantic-quality");
  assert.equal(quality.length > 0, true);
  assert.equal(quality.every((item) => item.severity === "info"), true);
  const codes = new Set(quality.map((item) => item.code));
  assert.equal(codes.has("SEMANTIC_QUALITY_COMMENT_MISSING"), true);
  assert.equal(codes.has("SEMANTIC_QUALITY_DISPLAY_NAME_MISSING"), true);
  assert.equal(codes.has("SEMANTIC_QUALITY_FORMAT_REVIEW"), true);
});

test("fully enriched explicit outputs have no semantic-quality gaps", () => {
  const run = check(
    join(fixtures, "valid", "enriched-fields.yml"),
    "--compute",
    "sql-warehouse",
    "--semantic-quality",
  );
  assert.equal(run.status, 0);
  const parsed = result(run);
  assert.equal(parsed.valid, true);
  assert.deepEqual(
    parsed.diagnostics.filter((item) => item.category === "semantic-quality"),
    [],
  );
});

test("semantic-quality mode skips unsupported YAML and runtime contexts", () => {
  const yaml01 = check(
    join(fixtures, "valid", "basic-dimensions-01.yml"),
    "--semantic-quality",
  );
  assert.equal(yaml01.status, 0);
  const yaml01Quality = result(yaml01).diagnostics.filter(
    (item) => item.category === "semantic-quality",
  );
  assert.deepEqual(
    yaml01Quality.map((item) => item.code),
    ["SEMANTIC_QUALITY_AGENT_METADATA_UNAVAILABLE"],
  );

  const dbr172 = checkYaml(
    `version: 1.1
source: samples.tpch.orders
fields:
  - name: status
    expr: o_orderstatus
`,
    "--runtime",
    "17.2",
    "--semantic-quality",
  );
  assert.equal(dbr172.status, 0);
  const dbrQuality = result(dbr172).diagnostics.filter(
    (item) => item.category === "semantic-quality",
  );
  assert.deepEqual(
    dbrQuality.map((item) => item.code),
    ["SEMANTIC_QUALITY_AGENT_METADATA_UNAVAILABLE"],
  );
});

test("semantic-quality mode does not flood invalid or wildcard definitions", () => {
  const invalid = check(
    join(fixtures, "invalid", "duplicate-key.yml"),
    "--semantic-quality",
  );
  assert.equal(invalid.status, 1);
  assert.equal(
    result(invalid).diagnostics.some((item) => item.category === "semantic-quality"),
    false,
  );

  const wildcard = checkYaml(
    `version: 1.1
source: samples.tpch.orders
comment: Explicit wildcard compatibility smoke.
fields:
  - expr: source.*
`,
    "--runtime",
    "18.2",
    "--semantic-quality",
  );
  assert.equal(wildcard.status, 0);
  const wildcardCodes = new Set(
    result(wildcard).diagnostics
      .filter((item) => item.category === "semantic-quality")
      .map((item) => item.code),
  );
  assert.equal(wildcardCodes.has("SEMANTIC_QUALITY_COMMENT_MISSING"), false);
  assert.equal(wildcardCodes.has("SEMANTIC_QUALITY_DISPLAY_NAME_MISSING"), false);
});

test("blank and conflicting metadata remain valid but receive hygiene suggestions", () => {
  const run = checkYaml(
    `version: 1.1
source: samples.tpch.orders
comment: ""
fields:
  - name: status
    expr: o_orderstatus
    comment: TODO confirm status meaning
    display_name: ""
    synonyms: [Status, " status ", shared, "", priority]
  - name: priority
    expr: o_orderpriority
    comment: Order priority from the source.
    display_name: Order Priority
    synonyms: [shared]
`,
    "--compute",
    "sql-warehouse",
    "--semantic-quality",
  );
  assert.equal(run.status, 0);
  const parsed = result(run);
  assert.equal(parsed.valid, true);
  const codes = new Set(
    parsed.diagnostics
      .filter((item) => item.category === "semantic-quality")
      .map((item) => item.code),
  );
  for (const code of [
    "SEMANTIC_QUALITY_EMPTY_METADATA",
    "SEMANTIC_QUALITY_PLACEHOLDER_METADATA",
    "SEMANTIC_QUALITY_DUPLICATE_SYNONYM",
    "SEMANTIC_QUALITY_REDUNDANT_SYNONYM",
    "SEMANTIC_QUALITY_AMBIGUOUS_SYNONYM",
  ]) {
    assert.equal(codes.has(code), true, `missing ${code}`);
  }
});

test("text output remains PASS when semantic-quality suggestions are present", () => {
  const run = checkText(
    join(fixtures, "valid", "basic-fields.yml"),
    "--semantic-quality",
  );
  assert.equal(run.status, 0);
  assert.match(run.stdout, /^PASS /);
  assert.match(run.stdout, /semanticQuality=true/);
  assert.match(run.stdout, /SEMANTIC_QUALITY_COMMENT_MISSING/);
});

test("canonical 0.1 dimensions-only form passes", () => {
  const run = check(join(fixtures, "valid", "basic-dimensions-01.yml"));
  assert.equal(run.status, 0);
  assert.equal(result(run).valid, true);
});

test("quoted and unquoted canonical versions are accepted but raw 1.10 is not", async () => {
  const base = await readFile(join(fixtures, "valid", "basic-dimensions-01.yml"), "utf8");
  for (const version of ["1.1", "'1.1'"]) {
    const run = spawnSync(process.execPath, [checker, "check", "-", "--format", "json"], {
      input: base.replace("version: 0.1", `version: ${version}`),
      encoding: "utf8",
    });
    assert.equal(run.status, 0);
  }
  const invalid = spawnSync(process.execPath, [checker, "check", "-", "--format", "json"], {
    input: base.replace("version: 0.1", "version: 1.10"),
    encoding: "utf8",
  });
  assert.equal(invalid.status, 1);
  assert.equal(result(invalid).diagnostics.some((item) => item.code === "UNSUPPORTED_YAML_SPEC_VERSION"), true);
});

test("duplicate YAML keys fail with source location", () => {
  const run = check(join(fixtures, "invalid", "duplicate-key.yml"));
  assert.equal(run.status, 1);
  const parsed = result(run);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.diagnostics.some((item) => item.code === "DUPLICATE_KEY"), true);
  assert.ok(parsed.diagnostics[0].line >= 1);
});

test("cross-field errors are accumulated", () => {
  const run = check(join(fixtures, "invalid", "cross-field.yml"), "--runtime", "18.2");
  assert.equal(run.status, 1);
  const codes = new Set(result(run).diagnostics.map((item) => item.code));
  for (const code of [
    "PARAMETER_DEFAULT_ORDER",
    "DUPLICATE_OUTPUT_NAME",
    "PARAMETERS_WITH_MATERIALIZATION",
    "INVALID_MATERIALIZATION_MODE",
    "UNSUPPORTED_TRIGGER_ON_UPDATE",
    "AGGREGATED_MATERIALIZATION_EMPTY",
  ]) {
    assert.equal(codes.has(code), true, `missing ${code}`);
  }
});

test("wildcard entries reject metadata", () => {
  const run = check(join(fixtures, "invalid", "wildcard-metadata.yml"), "--runtime", "18.2");
  assert.equal(run.status, 1);
  assert.equal(
    result(run).diagnostics.some((item) => item.code === "WILDCARD_ENTRY_HAS_EXTRA_FIELDS"),
    true,
  );
});

test("unknown fields are blocking by default and warnings in compatibility mode", () => {
  const file = join(fixtures, "invalid", "unknown-field.yml");
  const strict = check(file);
  assert.equal(strict.status, 1);
  assert.equal(result(strict).diagnostics.some((item) => item.code === "UNSUPPORTED_FIELD"), true);

  const compatible = check(file, "--allow-unknown");
  assert.equal(compatible.status, 0);
  const parsed = result(compatible);
  assert.equal(parsed.warningCount >= 1, true);
  assert.match(parsed.diagnostics[0].message, /does not prove/);
});

test("runtime compatibility errors only when a lower DBR target is supplied", () => {
  const file = join(fixtures, "valid", "basic-fields.yml");
  const unknown = check(file);
  assert.equal(unknown.status, 0);
  assert.equal(result(unknown).infoCount >= 1, true);

  const old = check(file, "--runtime", "17.2");
  assert.equal(old.status, 1);
  assert.equal(result(old).diagnostics.some((item) => item.code === "DATABRICKS_RUNTIME_TOO_OLD"), true);
});

test("DBR context requires a complete, strictly parsed runtime", () => {
  const file = join(fixtures, "valid", "basic-dimensions-01.yml");
  const missing = check(file, "--compute", "dbr");
  assert.equal(missing.status, 1);
  const missingResult = result(missing);
  assert.equal(
    missingResult.diagnostics.some((item) => item.code === "RUNTIME_VERSION_REQUIRED"),
    true,
  );
  assert.deepEqual(missingResult.context, {
    compute: "dbr",
    runtimeVersion: null,
    allowUnknownFields: false,
  });

  const malformed = check(file, "--runtime", "18.2junk");
  assert.equal(malformed.status, 1);
  const malformedResult = result(malformed);
  assert.equal(
    malformedResult.diagnostics.some((item) => item.code === "INVALID_RUNTIME_VERSION"),
    true,
  );
  assert.equal(malformedResult.context.runtimeVersion, "18.2junk");
});

test("window ranges reject undocumented units", () => {
  const run = check(join(fixtures, "invalid", "window-range.yml"), "--runtime", "18.2");
  assert.equal(run.status, 1);
  assert.equal(
    result(run).diagnostics.some((item) => item.code === "INVALID_WINDOW_RANGE_SHAPE"),
    true,
  );
});

test("DBR 19 accepts unitless numeric-index windows and integral aliases", () => {
  const file = join(fixtures, "valid", "numeric-window-19.yml");
  const current = check(file, "--runtime", "19");
  assert.equal(current.status, 0);
  const parsed = result(current);
  assert.equal(parsed.valid, true);
  assert.equal(
    parsed.diagnostics.some((item) => item.code === "NUMERIC_INDEX_DATA_NOT_VALIDATED"),
    true,
  );
  assert.equal(
    parsed.diagnostics.some((item) => item.code === "NONINTEGRAL_WINDOW_PARAMETER"),
    false,
  );

  const old = check(file, "--runtime", "18.2");
  assert.equal(old.status, 1);
  assert.equal(
    result(old).diagnostics.some((item) => item.code === "DATABRICKS_RUNTIME_TOO_OLD"),
    true,
  );
});

test("a bare unified runtime follows point releases in the same major line", () => {
  const file = join(fixtures, "valid", "parameters-window.yml");
  const unified = check(file, "--runtime", "18");
  assert.equal(unified.status, 0);
  assert.equal(
    result(unified).diagnostics.some((item) => item.code === "DATABRICKS_RUNTIME_TOO_OLD"),
    false,
  );

  const pointRelease = check(file, "--runtime", "18.0");
  assert.equal(pointRelease.status, 1);
  assert.equal(
    result(pointRelease).diagnostics.some((item) => item.code === "DATABRICKS_RUNTIME_TOO_OLD"),
    true,
  );

  const preUnified = check(join(fixtures, "valid", "basic-fields.yml"), "--runtime", "17");
  assert.equal(preUnified.status, 1);
  assert.equal(
    result(preUnified).diagnostics.some((item) => item.code === "DATABRICKS_RUNTIME_TOO_OLD"),
    true,
  );

  const preUnifiedBase = check(
    join(fixtures, "valid", "basic-dimensions-01.yml"),
    "--runtime",
    "16",
  );
  assert.equal(preUnifiedBase.status, 1);
  assert.equal(
    result(preUnifiedBase).diagnostics.some(
      (item) => item.code === "METRIC_VIEWS_RUNTIME_TOO_OLD",
    ),
    true,
  );
});

test("date and date_time formats require their documented options", () => {
  const run = check(join(fixtures, "invalid", "format-options.yml"), "--runtime", "19");
  assert.equal(run.status, 1);
  const codes = new Set(result(run).diagnostics.map((item) => item.code));
  for (const code of [
    "DATE_FORMAT_REQUIRED",
    "DATE_FORMAT_CANNOT_HIDE_DATE",
    "DATETIME_TIME_FORMAT_REQUIRED",
  ]) {
    assert.equal(codes.has(code), true, `missing ${code}`);
  }
});

test("materialization schedules enforce interval bounds and Quartz shape", () => {
  const base = `version: 1.1
source: samples.tpch.orders
fields:
  - name: status
    expr: o_orderstatus
materialization:
  schedule: every 999 hours
  mode: relaxed
  materialized_views:
    - name: baseline
      type: unaggregated
`;
  const interval = checkYaml(base, "--runtime", "19");
  assert.equal(interval.status, 1);
  assert.equal(
    result(interval).diagnostics.some(
      (item) => item.code === "MATERIALIZATION_SCHEDULE_OUT_OF_RANGE",
    ),
    true,
  );

  const malformedCron = checkYaml(base.replace("every 999 hours", "cron garbage"), "--runtime", "19");
  assert.equal(malformedCron.status, 1);
  assert.equal(
    result(malformedCron).diagnostics.some(
      (item) => item.code === "INVALID_MATERIALIZATION_SCHEDULE",
    ),
    true,
  );

  const cron = checkYaml(
    base.replace("every 999 hours", "cron '0 0 0 * * ?' at time zone 'UTC'"),
    "--runtime",
    "19",
  );
  assert.equal(cron.status, 0);
  assert.equal(
    result(cron).diagnostics.some(
      (item) => item.code === "MATERIALIZATION_CRON_ANALYZER_REQUIRED",
    ),
    true,
  );
});

test("malformed wildcard exclusions fail and an empty rely map remains valid", () => {
  const wildcard = check(join(fixtures, "invalid", "wildcard-except.yml"), "--runtime", "19");
  assert.equal(wildcard.status, 1);
  assert.equal(
    result(wildcard).diagnostics.some((item) => item.code === "INVALID_WILDCARD_EXPRESSION"),
    true,
  );

  const rely = checkYaml(
    `version: 1.1
source: samples.tpch.orders
joins:
  - name: customer
    source: samples.tpch.customer
    using: [o_custkey]
    rely: {}
fields:
  - name: status
    expr: o_orderstatus
`,
    "--runtime",
    "19",
  );
  assert.equal(rely.status, 0);
  assert.equal(result(rely).valid, true);
});

test("one-to-many joins reject a contradictory many-to-one RELY promise", () => {
  const run = check(join(fixtures, "invalid", "one-to-many-rely.yml"), "--runtime", "19");
  assert.equal(run.status, 1);
  const parsed = result(run);
  assert.equal(parsed.valid, false);
  assert.equal(
    parsed.diagnostics.some((item) => item.code === "CONTRADICTORY_JOIN_RELY"),
    true,
  );
  assert.equal(
    parsed.diagnostics.some((item) => item.code === "JOIN_RELY_DATA_NOT_VALIDATED"),
    false,
  );
});

test("nested join subtrees require uniform cardinality in both directions", () => {
  const oneToManyParent = check(
    join(fixtures, "invalid", "nested-many-to-one-under-one-to-many.yml"),
    "--runtime",
    "19",
  );
  assert.equal(oneToManyParent.status, 1);
  assert.equal(
    result(oneToManyParent).diagnostics.some(
      (item) => item.code === "ONE_TO_MANY_DESCENDANT_CARDINALITY",
    ),
    true,
  );

  const manyToOneParent = check(
    join(fixtures, "invalid", "nested-one-to-many-under-many-to-one.yml"),
    "--runtime",
    "19",
  );
  assert.equal(manyToOneParent.status, 1);
  assert.equal(
    result(manyToOneParent).diagnostics.some(
      (item) => item.code === "MANY_TO_ONE_DESCENDANT_CARDINALITY",
    ),
    true,
  );
});
