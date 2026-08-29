# Skill behavior

The `databricks-metric-view` skill supports five workflows.

| Workflow | Databricks access | Databricks changes |
| --- | --- | --- |
| Create a draft from supplied requirements | Not needed | None |
| Review or edit an existing definition | Not needed | None |
| Discover source semantics from metadata | Selected profile, metadata only | None |
| Discover value shape and relationships | Selected profile, authorized bounded samples | None |
| Deploy and verify a view | Profile, compute, target, and explicit intent | Creates or updates the named target |

## What to include in a request

For a draft or edit, provide:

- the desired business outcome;
- the source table or current YAML;
- trusted fields, measures, units, filters, and relationships;
- the target compute when known;
- whether the skill may edit files.

For discovery from real assets, also provide:

- the authenticated Databricks profile;
- exact source tables and business questions;
- metadata-only or bounded-sampling scope;
- read warehouse, sample fraction or bucket, estimated scan cap, returned-row cap, profiling-query cap, timeout, and sensitive-data exclusions;
- any trusted SQL, KPI file, dashboard, Genie Agent, or glossary it may use.

For deployment, also provide:

- the SQL warehouse or other supported compute;
- the fully qualified target name;
- create-only or update-existing intent;
- representative parameters and trusted comparison SQL when relevant.

## What the skill does

The skill:

1. identifies the business question and source grain;
2. checks for overlapping metric views when a target schema is in scope;
3. inventories metadata before reading rows;
4. samples only within the authorized scope;
5. labels semantic evidence as business-authoritative, governed metadata, observed, or inferred, with locator and currentness;
6. proposes fields, measures, joins, filters, descriptions, and synonyms with provenance;
7. preserves unrelated content during focused edits;
8. checks every generated or edited definition automatically;
9. separates semantic evidence, local checks, Databricks acceptance, smoke tests, and business reconciliation.

## Safety boundaries

The skill does not:

- ask for Databricks authentication for an offline draft or review;
- auto-select a Databricks profile;
- sample data during a metadata-only request;
- mine query history, dashboards, or Genie content without explicit scope;
- silently treat an unavailable or empty metadata, dashboard, or Genie fetch as evidence that nothing exists;
- expose sensitive raw values by default;
- invent source columns, business definitions, relationships, code labels, or cardinality;
- describe a sampled result as full-table truth;
- describe a local result as acceptance by Databricks;
- create or update a Databricks object without an explicit request;
- reset grants or object identity when a safe `ALTER VIEW` update is intended;
- print or store credentials in project files.

It stops and asks for direction when a missing choice changes business meaning, exceeds sampling scope, exposes sensitive values, or resets an unresolved target.

## Requests outside this skill

Use another workflow for Snowflake semantic views, dbt Semantic Layer models, ordinary SQL views, or Databricks Asset Bundle `databricks.yml` files.
