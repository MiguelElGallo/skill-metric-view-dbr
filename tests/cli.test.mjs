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
