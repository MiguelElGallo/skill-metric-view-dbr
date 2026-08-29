# Validation levels

Use this reference when explaining confidence, choosing live checks, or reporting results.

## Level 1: local definition

The bundled checker verifies YAML parsing, duplicate keys, documented field shapes, required and exclusive fields, locally knowable cross-references, and supplied compute compatibility.

It does not validate SQL expressions, objects, permissions, source data, join cardinality, parameter castability, or Databricks analyzer behavior. Keep its disclaimer in the result.

## Level 2: semantic evidence

Metadata, authorized samples, governed definitions, trusted SQL, and observed usage can justify why a field, measure, join, filter, name, or synonym belongs.

Record provenance as business-authoritative, governed/declarative metadata, observed, or inferred, including locator, owner, retrieval time, and currentness. Sampling can show value shape; it does not prove full-table properties or business meaning.

## Level 3: live context

Bounded read-only checks can confirm:

- profile, host, compute, and target schema;
- source and join objects and columns;
- visible types, comments, tags, and declared constraints;
- authorized sample statistics and relationship evidence;
- relevant platform feature availability.

This still does not prove that Databricks accepts the complete definition.

## Level 4: Databricks analyzer

Databricks must analyze the complete metric-view statement. A temporary session canary proves parser/analyzer behavior and source resolution in that session, not final-target permissions or ownership. Only an authorized create or update against the fully qualified persistent target proves acceptance in that target's catalog, schema, compute, and permission context.

It does not prove that each metric matches its business definition.

## Level 5: result validation

Query every important measure at useful grains and filters. When trusted SQL or expected outputs exist, align snapshot or as-of time, timezone, parameters, filters, grouping keys, null and zero-denominator behavior, rounding, and absolute and relative tolerance. Re-test joins at grains likely to expose fan-out.

Record the exact query, parameters, result summary, and remaining coverage. Avoid saying a metric is correct when only object creation or one smoke query succeeded.

## Diagnostic policy

- **Error:** deterministic local failure or a supplied DBR target below a documented minimum.
- **Warning:** a material risk needing SQL, metadata, data, business, or analyzer evidence.
- **Info:** a feature requirement or limitation when target context is unknown or uses an auto-updated SQL warehouse.
- **Unsupported field:** the checker does not know the field. Default preflight treats it as an error without claiming Databricks rejects it; compatibility mode can downgrade it after documentation review.

Current references:

- https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/yaml-reference
- https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/feature-availability
