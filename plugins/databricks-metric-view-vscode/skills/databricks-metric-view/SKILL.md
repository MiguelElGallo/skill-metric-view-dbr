---
name: databricks-metric-view
description: Author, discover semantics for, edit, audit, and locally validate Databricks Unity Catalog metric-view YAML and WITH METRICS DDL. Use for Databricks metric views, table and column semantic discovery, bounded sampling for field or measure design, metric-view YAML, fields or dimensions, measures, joins, parameters, materialization, malformed YAML, or preflight checks. Do not use for Snowflake semantic views, dbt semantic models, ordinary views, or databricks.yml bundles.
---

# Databricks Metric Views

Build evidence-backed Databricks metric views and check every definition before workspace submission.

## Route the request

- **Check or audit YAML:** work offline unless the user requests live evidence. Do not modify the file unless asked.
- **Create from supplied requirements:** draft from the named source columns and trusted business definitions without requesting authentication.
- **Discover semantics from real assets:** use the selected profile and bounded source scope. Inventory metadata first; sample actual data only when the user authorized sampling. Read [semantic-discovery.md](references/semantic-discovery.md). For live retrieval, also read [live-discovery-operations.md](references/live-discovery-operations.md).
- **Edit YAML:** preserve unrelated content, ordering, scalar style, and comments; make the smallest requested change.
- **Deploy or live-validate:** run the local gate first, then read [deployment.md](references/deployment.md) before constructing or submitting any DDL. Continue only with the profile, warehouse, target, and create/update intent authorized by the user.

For create, edit, and audit guidance, read [authoring.md](references/authoring.md). For supported grammar and feature gates, read [yaml-reference.md](references/yaml-reference.md).

## Build semantics before syntax

For a view based on real assets:

1. State the business question and the row grain the source appears to represent.
2. Build an evidence inventory for tables, columns, keys, relationships, values, existing metrics, and business language.
3. Label every candidate field, measure, join, filter, comment, and synonym as business-authoritative, governed metadata, observed, or inferred.
4. Resolve business-critical ambiguity before writing YAML. Batch related questions instead of asking one at a time.
5. Draft the smallest useful view. Prefer a direct one-fact, many-to-one star when it fits. For multiple grains, evaluate native one-to-many or bridge-source modeling before proposing a separate base view.

Do not generate a broad metric view from column names alone. Do not turn samples, naming heuristics, or repeated SQL into business truth without saying what was inferred.

## Mandatory local gate

After every generated or edited definition, call the bundled MCP tool:

~~~text
check_databricks_metric_view_yaml
~~~

Prefer YAML text. Pass `compute: sql-warehouse` for a SQL warehouse target. Pass `compute: dbr` plus `runtime_version` for cluster compatibility checks.

If MCP is unavailable, locate the plugin root (two directories above this `SKILL.md`) and run the bundled launcher:

~~~bash
<plugin-root>/bin/checker.cmd check <metric-view.yml> --format json
~~~

Add `--compute sql-warehouse`, or `--compute dbr --runtime <version>`, when target context is known. If neither MCP nor CLI runs, report that the mandatory local gate is unavailable; do not silently replace it with visual inspection and submit to Databricks.

## State the proof level

Keep these levels distinct:

1. **Local:** YAML parsing, documented structure, cross-field rules, and supplied compatibility context.
2. **Semantic evidence:** metadata, authorized samples, trusted SQL, and business definitions used to justify the design.
3. **Live context:** read-only verification of objects, columns, permissions, compute, and feature availability.
4. **Databricks analyzer/deployment:** the workspace accepted the complete definition.
5. **Result validation:** smoke queries and, when available, reconciliation against trusted SQL at relevant grains.

A local PASS must retain the disclaimer that SQL expressions, catalog objects, permissions, source data, join cardinality, and Databricks analyzer behavior were not validated. Never summarize local-only success as “Databricks-valid.” Read [validation-levels.md](references/validation-levels.md) when proof or limitations matter.

## Semantic evidence boundaries

- Never auto-select a Databricks profile. Honor the profile and source scope selected by the user.
- Metadata reads may inspect catalogs, schemas, tables, columns, comments, tags, constraints, properties, and existing metric-view definitions within scope.
- Actual rows, value distributions, null rates, uniqueness, referential coverage, and fan-out are data access. Use them only when sampling or profiling was explicitly requested or authorized. Before the first query, state the columns, sample fraction or bucket, returned-row cap, maximum profiling-query count, timeout, warehouse, and estimated scan bound when available.
- `discover-schema` returns sample rows, null counts, and a total row count. Do not use it for metadata-only or ordinary bounded-sampling work; it needs separate authorization for full-table profiling.
- Exclude tagged or plausibly sensitive columns from raw sample output by default. Prefer aggregates, redact values, and ask before exposing personal or secret data.
- Query history, dashboard definitions, Genie instructions, and other user activity need explicit scope. Do not mine them merely because access exists.
- Treat primary, foreign-key, unique, and `RELY` constraints as declared metadata, not proof that the data conforms. Databricks enforces `NOT NULL` and `CHECK` constraints. Treat `rely.at_most_one_match: true` as a directional correctness promise.
- Preserve evidence provenance: exact locator, owner or approving authority, retrieval time, and conflict/currentness status. Do not promote a comment, tag, or declared key to business truth without ownership or curation evidence. If comments, formulas, or code mappings conflict, surface the conflict instead of choosing silently.

## Databricks design and deployment boundaries

- Treat current Databricks documentation as authoritative when it differs from a bundled reference or skill snapshot.
- Prefer `fields` for new YAML; preserve `dimensions` in existing definitions unless migration was requested.
- Start with atomic measures, then compose reusable ratios with `MEASURE(...)`. Record units, filters, denominator semantics, and source grain.
- For one-to-many modeling, require YAML 1.1 and Databricks Runtime 18.1 or newer. Keep each nested join subtree at one cardinality, do not expose fields from one-to-many branches, and keep each aggregation function on one source branch.
- Humanize codes only from documented or observed mappings whose meaning is known. Sample values alone do not define labels.
- Do not claim local SQL parsing, source-column resolution, data-type checking, permission checks, or join-cardinality verification.
- Use OAuth profiles and explicit `--profile` flags. Keep credentials and sensitive sample values out of files and command output.
- Before any analyzer canary or persistent DDL, read [deployment.md](references/deployment.md). Use its stable Statement Execution API path; do not send metric-view DDL through helpers that can rewrite multiline arguments.
- Run the local gate against the exact YAML payload that will appear between `$$` delimiters. If serialization, formatting, or a correction changes that payload, check the changed payload again before submission.
- Submit one checked statement. After a deterministic YAML or DDL analyzer error, inspect the error, make one justified correction, rerun the local gate, and only then submit again. For permission, ownership, target-state, context, transport, timeout, or unknown-outcome failures, do not change or resubmit the payload; resolve or poll the original operation first.
- Create a missing target with `CREATE VIEW`. Update an existing metric view with `ALTER VIEW ... AS $$...$$` by default so grants and object identity are preserved. Use `CREATE OR REPLACE` only when the user explicitly accepts the grant and `table_id` reset.

## Authorization and stopping points

- Offline checks and edits need no Databricks profile.
- Read-only metadata discovery is allowed when necessary and the user selected the profile and source scope.
- Bounded data sampling is allowed only within the explicitly authorized tables, columns, and cap.
- Do not create, alter, replace, or drop the final metric view unless requested.
- Ask before profiling data outside the agreed sample, exposing sensitive values, asserting business meaning, asserting cardinality, resetting an existing view, or dropping anything not created temporarily during this task.

## Return

Report:

- Business purpose, source grain, and unresolved semantic questions.
- Evidence inventory with provenance and confidence; sampling scope and redactions when used.
- Files created or changed.
- Local status, error/warning counts, compatibility context, and proof disclaimer.
- For live work: profile, host, warehouse, source and target scope, analyzer result, exact smoke-query invocation, reconciliation result, and temporary-object cleanup.
- Remaining checks that require Databricks data, analyzer access, or business-owner confirmation.
