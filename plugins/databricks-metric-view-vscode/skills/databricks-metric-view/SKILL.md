---
name: databricks-metric-view
description: Author, discover semantics for, edit, audit, and locally validate Databricks Unity Catalog metric-view YAML and WITH METRICS DDL. Use for Databricks metric views, table and column semantic discovery, bounded sampling for field or measure design, metric-view YAML, fields or dimensions, measures, joins, parameters, materialization, malformed YAML, or preflight checks. Do not use for Snowflake semantic views, dbt semantic models, ordinary views, or databricks.yml bundles.
---

# Databricks Metric Views

Build evidence-backed Databricks metric views and check every definition before workspace submission.

## Route the request

- **Check or audit YAML:** work offline unless the user requests live evidence. Do not modify the file unless asked. For a wrong natural-language answer or metric result, reproduce the same question or query, identify the smallest semantic-layer gap, patch only that gap, and rerun the same test.
- **Create from supplied requirements:** treat named columns and measures as required seeds, not an exhaustive semantic specification. They are complete only when the user says `only` or `exactly`, supplies an authoritative complete specification, or explicitly requests an offline structural smoke test.
- **Discover semantics from real assets:** use this route for any create or improve request that names a selected profile or asks to inspect accessible workspace assets, even when the prompt lists fields or measures. `only` limits outputs; it never waives complete metadata classification or production readiness. Use the selected profile and bounded source scope. Inventory metadata first; sample actual data only when the user authorized sampling. Read [semantic-discovery.md](references/semantic-discovery.md). For live retrieval, also read [live-discovery-operations.md](references/live-discovery-operations.md).
- **Edit YAML:** preserve unrelated content, ordering, scalar style, and comments; make the smallest requested change.
- **Installation or structural smoke:** use only when the user explicitly asks to prove installation, packaging, transport, or analyzer acceptance. Record the exact narrow scope and label the result non-production. The word `minimal` alone does not select this route.
- **Deploy or live-validate:** run the local gate first, then read [deployment.md](references/deployment.md) before constructing or submitting any DDL. Continue only with the profile, warehouse, target, and create/update intent authorized by the user.

For create, edit, and audit guidance, read [authoring.md](references/authoring.md). For supported grammar and feature gates, read [yaml-reference.md](references/yaml-reference.md).

## Build semantics before syntax

For every production-intended view based on real assets:

1. State the business question and the row grain the source appears to represent.
2. Retrieve the complete metadata-only schema for every bounded source table. Classify every source column as include, exclude, or defer with a reason; named requirements are seeds unless explicitly exhaustive.
3. Build an evidence inventory for tables, columns, keys, relationships, values, existing metrics, and business language.
4. Label every candidate field, measure, join, filter, comment, display name, format, and synonym as business-authoritative, governed metadata, observed, or inferred.
5. Resolve business-critical ambiguity before deployable YAML. Batch related questions instead of asking one at a time.
6. Draft the smallest semantically complete view for the agreed questions and consumers. Prefer a direct one-fact, many-to-one star when it fits. For multiple grains, evaluate native one-to-many or bridge-source modeling before proposing a separate base view.

Do not generate a broad metric view from column names alone. Do not turn samples, naming heuristics, or repeated SQL into business truth without saying what was inferred.

### Treat semantic metadata as required work

Databricks calls descriptions `comment`. For production-oriented agent or Genie use, treat the following as required semantic work even though the YAML schema makes them optional:

- a durable view-purpose `comment`;
- a useful `comment` and `display_name` for every explicit field and measure;
- an approved `format` wherever type, unit, currency, percentage, date, or time semantics justify one;
- genuine `synonyms` after reviewing the vocabulary used by the intended consumers. No synonym is better than an invented or ambiguous one.

Put durable business descriptions in YAML `comment` properties. Databricks removes single-line YAML comments written with `#` when it saves a version 1.1 definition, so never rely on comment tokens to preserve semantic meaning.

Treat agent metadata as downstream-facing behavior. AI/BI dashboards automatically consume `display_name` and `format` for datasets and visualizations, while Genie automatically imports `synonyms` for natural-language discovery. Review those consumers after changing this metadata; a technically valid alias or format can still mislead users.

Read existing business-authoritative and governed descriptions, comments, aliases, tags, glossary terms, Genie instructions, KPI definitions, and trusted SQL first. Preserve and reuse existing metadata only when it applies to the same semantic element and has no unresolved conflict. Prefer owned, current, business-approved definitions over a fixed source-type order.

If terminology is missing, draft provenance-bearing suggestions and ask for approval before placing new business meaning in deployable YAML. Keep each suggestion outside the YAML with `value`, `yaml_path`, `evidence_class`, `locator`, `owner/currentness`, and `status: proposed|approved|rejected`. A request to deploy does not approve invented semantics. Broad permission such as `use your best judgment` or `do not ask` authorizes drafting proposals, not marking them approved; each exact critical text, formula, unit, mapping, filter, key, join, or synonym must have current authoritative support or explicit acceptance after presentation. Mechanical display formatting that adds no new meaning may proceed without a business checkpoint; currency, units, code labels, filters, formulas, joins, and aggregation behavior are not mechanical.

### Production semantic readiness gate

Before producing deployable YAML, record:

- question-to-field, measure, and filter coverage;
- source role, grain, keys, and time behavior;
- an include, exclude, or defer decision for every bounded source column;
- each measure's formula, filters, unit, distinct key, additivity, numerator, denominator, null/zero behavior, and intended grain where applicable;
- relationship evidence, cardinality status, and conformance status;
- exclusions, sensitive fields, unresolved conflicts, and open gaps.

There is no numeric minimum for fields or measures. A narrow view is ready when it completely covers the agreed scope. If a business-critical formula, unit, filter, key, join, code mapping, or cardinality remains inferred or conflicted, keep it in the suggestion inventory and out of deployable YAML until approved or resolved by current authoritative evidence.

## Mandatory local gate

After every generated or edited definition, call the bundled MCP tool:

~~~text
check_databricks_metric_view_yaml
~~~

Prefer YAML text. Pass `compute: sql-warehouse` for a SQL warehouse target. Pass `compute: dbr` plus `runtime_version` for cluster compatibility checks.

For creation, semantic improvement, or a full semantic audit, also pass `semantic_quality: true`. Those diagnostics are non-blocking presence and synonym-hygiene suggestions; they cannot prove business meaning, approval, source types, units, or completeness. Resolve or explicitly account for them before calling a production definition semantically ready. A syntax-only check or explicit structural smoke may omit this option.

If MCP is unavailable, locate the plugin root (two directories above this `SKILL.md`) and run the bundled launcher:

~~~bash
<plugin-root>/bin/checker.cmd check <metric-view.yml> --format json
~~~

Add `--semantic-quality` for creation, semantic improvement, or a full semantic audit. Add `--compute sql-warehouse`, or `--compute dbr --runtime <version>`, when target context is known. If neither MCP nor CLI runs, report that the mandatory local gate is unavailable; do not silently replace it with visual inspection and submit to Databricks.

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
- Keep retrieved customer metric-view definitions, Genie exports, query-history extracts, Databricks logs, sampled values, and temporary validation payloads out of the repository unless the user explicitly requests a safe redacted artifact.
- Treat primary, foreign-key, unique, and `RELY` constraints as declared metadata, not proof that the data conforms. Databricks enforces `NOT NULL` and `CHECK` constraints. Use metric-view `rely.at_most_one_match: true` only for a many-to-one join and treat it as an unvalidated correctness promise.
- Preserve evidence provenance: exact locator, owner or approving authority, retrieval time, and conflict/currentness status. Do not promote a comment, tag, or declared key to business truth without ownership or curation evidence. If comments, formulas, or code mappings conflict, surface the conflict instead of choosing silently.
- Preservation is not endorsement. Copying a source comment to a transformed field, filtered measure, ratio, window, renamed output, or new object is a new semantic assertion that needs scope validation.

## Databricks design and deployment boundaries

- Treat current Databricks documentation as authoritative when it differs from a bundled reference or skill snapshot.
- Prefer `fields` for new YAML; preserve `dimensions` in existing definitions unless migration was requested.
- Start with atomic measures, then compose reusable ratios with `MEASURE(...)`. Record units, filters, denominator semantics, and source grain.
- Prefer explicit fields, comments, display names, synonyms, formats, measures, filters, and joins over broad AI instructions. Use Genie instructions only when explicitly in scope and the semantic model cannot express the needed behavior directly.
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
- Evidence inventory with provenance and confidence; the complete column include/exclude/defer ledger; sampling scope and redactions when used.
- Question coverage, measure contracts, relationship status, semantic-readiness result, and any proposed terminology kept outside YAML.
- Files created or changed.
- Local status, error/warning counts, compatibility context, and proof disclaimer.
- For live work: profile, host, warehouse, source and target scope, analyzer result, exact smoke-query invocation, reconciliation result, and temporary-object cleanup.
- Remaining checks that require Databricks data, analyzer access, or business-owner confirmation.
