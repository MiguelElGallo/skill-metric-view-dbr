# Validation levels

Use this reference when explaining confidence, choosing live checks, or reporting results.

## Level 1: local

The bundled checker verifies YAML 1.2 parsing, duplicate keys, one-document input, documented field shapes, required and exclusive fields, cross-references that are knowable locally, and feature compatibility when target context is supplied.

It does **not** validate:

- Databricks SQL expression syntax or function support.
- Whether source or joined objects and columns exist.
- Permissions, masks, row filters, or ABAC policies.
- Parameter default castability.
- Actual join cardinality or the truth of `rely.at_most_one_match`.
- Wildcard-expanded name collisions.
- Databricks analyzer or optimizer behavior.

The local result's disclaimer is part of the result and must not be omitted.

## Level 2: live context

Use bounded read-only checks when the user wants more than offline linting and has selected a profile:

- Confirm the host, user, SQL warehouse or cluster, and target schema.
- Inspect source and join schemas.
- Check that named columns exist and basic data types fit the expressions.
- Assess many-to-one promises with bounded duplicate-key queries when authorized.
- Confirm relevant runtime or SQL-warehouse feature availability.

This still does not prove the full YAML will be accepted.

## Level 3: Databricks analyzer/deployment

Databricks must analyze the complete `WITH METRICS LANGUAGE YAML` statement. A successful analyzer result proves the submitted definition was accepted in that context. If deployment was requested, query explicit fields and `MEASURE(...)` outputs and compare important metrics to trusted SQL.

Record profile, host, compute, target, statement state, smoke query, and cleanup. Avoid saying a metric is correct when only object creation succeeded.

## Diagnostic policy

- **Error:** deterministic local failure or a supplied DBR target below a documented minimum.
- **Warning:** a material risk needing SQL, source schema, data, or analyzer evidence.
- **Info:** a feature requirement or limitation when the target context is unknown or uses an auto-updated SQL warehouse.
- **Unsupported field:** the checker does not know the field. Default preflight treats it as an error without claiming Databricks rejects it; compatibility mode can downgrade it after documentation review.

Current references (verified 2026-08-29):

- https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference
- https://docs.databricks.com/gcp/en/uc-semantics/metric-views/feature-availability
