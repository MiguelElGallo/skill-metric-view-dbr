# Authoring, editing, and audit workflow

Use this reference for create, edit, and audit requests.

## Audit

1. Read the complete YAML without changing it.
2. Run the local checker offline.
3. Group findings into deterministic errors, compatibility requirements, and live-only risks.
4. Do not ask for Databricks authentication unless the user requests live context or analyzer proof.

## Edit

1. Preserve unrelated fields, ordering, scalar style, and comments.
2. Make the smallest change that satisfies the request.
3. Prefer `fields` for new definitions but do not rename an existing `dimensions` collection without request.
4. Run the local checker on the resulting complete document.
5. If the gate fails, fix only issues introduced or explicitly in scope; report pre-existing findings separately.

## Create from tables

1. Confirm the selected Databricks profile and bounded source scope before live discovery.
2. Inspect source and join columns, types, comments, primary/foreign-key metadata, and representative cardinality evidence.
3. Preserve authoritative business descriptions. Suggest inferred labels, synonyms, calculations, and relationships rather than silently presenting them as facts.
4. Start from the smallest useful fields and atomic measures. Add composed measures, joins, parameters, windows, and materialization only when the use case needs them.
5. Run the local checker before proposing workspace submission.

## Design guidance

- Use explicit stable names; field and measure names share the metric-view output namespace.
- Use `MEASURE(...)` for composed measures and for querying metric-view measures.
- Prefer many-to-one dimension joins. Treat one-to-many and `rely` declarations as correctness-sensitive.
- Add useful `comment`, `display_name`, `format`, and genuine `synonyms` with YAML 1.1 when the target supports agent metadata.
- Avoid materialization until query patterns justify it; parameterized metric views cannot be materialized.
- Use block scalars for multiline SQL expressions. YAML syntax success does not prove Databricks SQL success.

Current Databricks examples and patterns:

- https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference
- https://github.com/databricks/databricks-agent-skills/tree/main/plugins/databricks/claude/skills/databricks-metric-views

The documentation is authoritative when the agent-skill snapshot differs.
