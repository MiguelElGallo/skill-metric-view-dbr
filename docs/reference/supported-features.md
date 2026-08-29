# Supported metric-view features

The skill can create, edit, and review Databricks Unity Catalog metric-view definitions using YAML `0.1` or `1.1`.

## Definition features

The skill understands:

- table or SQL-query sources;
- fields and the equivalent `dimensions` keyword;
- atomic and composed measures;
- filters and joins;
- parameters;
- window measures;
- display names, comments, formats, and synonyms;
- materialization settings;
- compute and feature compatibility when a target is supplied.

For new definitions, it prefers `fields`. It preserves `dimensions` in an existing definition unless you ask for a migration.

## Live workflows

With an authenticated profile and a bounded request, the skill can:

- inspect source objects, columns, comments, tags, and declared keys;
- identify likely table roles and row grain;
- sample authorized, non-sensitive columns for value shape and relationship evidence;
- combine trusted SQL, KPI files, dashboards, or Genie context when explicitly in scope;
- propose fields, measures, joins, filters, descriptions, and synonyms with evidence provenance;
- confirm the selected compute and target;
- submit a definition when deployment is explicit;
- read back the created view;
- query fields and measures as a smoke test;
- reconcile important results with trusted SQL when available.

Databricks Runtime, SQL warehouse, CLI, dashboard, and Genie capabilities change over time. The skill verifies an operation before relying on it. If a requested surface is unavailable or empty, it reports the gap and asks for an export or supplied SQL instead of silently skipping it.

## Important limits

A draft cannot prove that:

- a SQL expression resolves against a real source;
- the current identity has the required permissions;
- a declared join cardinality is true in the data;
- a measure matches the intended business definition;
- Databricks will accept and execute the complete definition.

Those claims need live metadata, analyzer acceptance, data tests, or business review. See [What the skill can prove](../explanation/what-the-skill-can-prove.md).

Current platform references:

- [Metric views overview](https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/)
- [Metric-view YAML reference](https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/yaml-reference)
- [Feature availability](https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/feature-availability)
