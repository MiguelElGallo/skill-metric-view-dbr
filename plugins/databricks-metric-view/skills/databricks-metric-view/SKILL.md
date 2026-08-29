---
name: databricks-metric-view
description: Author, edit, audit, and locally validate Databricks Unity Catalog metric-view YAML and WITH METRICS DDL before submission. Use for Databricks metric views, metric-view YAML, fields or dimensions, measures, joins, parameters, materialization, malformed YAML, or preflight checks. Do not use for Snowflake semantic views, dbt semantic models, ordinary views, or databricks.yml bundles.
---

# Databricks Metric Views

Create and change Databricks metric-view definitions with a fast local gate before any workspace submission.

## Route the request

- **Check or audit YAML:** work fully offline. Do not request authentication, call Databricks, or modify the file unless the user asks for changes.
- **Edit YAML:** preserve unrelated content, ordering, and comments; make the smallest requested change; then run the local checker.
- **Create from real tables:** inspect bounded source metadata when the user has selected a Databricks profile and source scope. Do not invent columns, relationships, cardinality, or business definitions.
- **Deploy or live-validate:** run the local checker first. A local error is a hard stop. Continue only with the profile, warehouse, target, and replace/create intent authorized by the user.

For create, edit, and audit guidance, read [authoring.md](references/authoring.md). For the supported grammar and feature gates, read [yaml-reference.md](references/yaml-reference.md).

## Mandatory local gate

After every generated or edited definition, call the bundled MCP tool:

```text
check_databricks_metric_view_yaml
```

Prefer passing YAML text. Pass `compute: sql-warehouse` for a SQL warehouse target. Pass `compute: dbr` plus `runtime_version` for cluster compatibility checks.

If MCP is unavailable, locate the plugin root (two directories above this `SKILL.md`) and run:

```bash
node <plugin-root>/dist/checker.mjs check <metric-view.yml> --format json
```

Use `--compute sql-warehouse`, or `--compute dbr --runtime <version>`, when target context is known. If neither MCP nor CLI runs, report that the mandatory local gate is unavailable; do not silently replace it with visual inspection and submit to Databricks.

## State the proof level

Keep these levels distinct:

1. **Local:** YAML 1.2 parsing, documented structure, cross-field rules, and supplied compatibility context.
2. **Live context:** optional read-only verification of objects, columns, permissions, compute, and feature availability.
3. **Databricks analyzer/deployment:** the workspace accepted the full definition; follow with a query smoke test when deployment was requested.

A local PASS must retain the checker's disclaimer: SQL expressions, catalog objects, permissions, source data, join cardinality, and Databricks analyzer behavior were not validated. Never summarize local-only success as “Databricks-valid.” Read [validation-levels.md](references/validation-levels.md) when remote proof or limitations matter.

## Databricks boundaries

- Treat the current Databricks documentation as authoritative when it differs from a bundled reference or agent-skill snapshot.
- Prefer `fields` for new YAML; preserve `dimensions` in existing definitions unless a migration is requested.
- Treat `rely.at_most_one_match: true` as a data promise, not a checked constraint. Warn that a false promise can silently produce incorrect measures.
- Do not claim local SQL parsing, source-column resolution, data-type checking, permission checks, or join-cardinality verification.
- Keep credentials out of files and command output. Use OAuth profiles and explicit `--profile` flags.
- Do not deploy through a command path that changes YAML indentation. Use the stable Statement Execution API described in [deployment.md](references/deployment.md).

## Authorization and stopping points

- A local check/audit is read-only and needs no Databricks profile.
- Read-only metadata discovery is allowed when it is necessary and the user has selected the profile/source scope.
- Do not create or replace the final metric view unless requested. Do not add a redundant confirmation after an explicit deploy request when profile, warehouse, target, and replacement scope are already clear.
- Ask before replacing an unresolved existing target, inventing business semantics, asserting cardinality, or dropping anything not created temporarily during this task.

## Return

Report:

- Files created or changed.
- Local checker status, error/warning counts, and proof disclaimer.
- Compute/runtime compatibility context used.
- For live work: profile, host, warehouse, catalog/schema/target, analyzer result, smoke-test result, and temporary-object cleanup.
- Any remaining checks that require Databricks data or analyzer access.
