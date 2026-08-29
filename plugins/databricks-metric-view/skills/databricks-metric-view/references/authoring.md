# Authoring, editing, and audit workflow

Use this reference for focused create, edit, and audit requests. For real-table discovery, also read [semantic-discovery.md](semantic-discovery.md).

## Audit

For an offline definition audit:

1. Read the complete YAML without changing it.
2. Run the local gate.
3. Group findings into deterministic definition errors, compatibility requirements, semantic questions, and live-only risks.
4. Do not request Databricks authentication unless the user asks for real-source evidence.

For a semantic audit with authorized sources, also check:

- whether the stated business purpose and source grain are clear;
- fields without evidence-backed descriptions or useful grouping/filtering value;
- measures with ambiguous units, filters, distinct keys, or aggregation grain;
- duplicated or conflicting expressions, names, comments, and synonyms;
- joins without governed or tested relationship evidence;
- missing fields, measures, or filters needed by supplied business questions;
- overlap with existing metric views in the target schema.

## Edit

1. Preserve unrelated fields, ordering, scalar style, and comments.
2. Make the smallest change that satisfies the request.
3. Prefer `fields` for new definitions but do not rename an existing `dimensions` collection without request.
4. Preserve existing business metadata unless stronger evidence shows a conflict.
5. Run the local gate on the complete result.
6. Fix issues introduced or explicitly in scope; report unrelated pre-existing findings separately.

When editing a deployed view, retrieve its complete current YAML before changing it. Default to `ALTER VIEW ... AS $$...$$` for an authorized update so grants and object identity are preserved.

## Create from supplied requirements

When the user supplies trusted source columns and metric definitions:

1. State the intended source grain.
2. Use only supplied or clearly authoritative fields, formulas, units, filters, and relationships.
3. Mark useful but unconfirmed descriptions, synonyms, ratios, or code labels as suggestions.
4. Start with the smallest useful definition and run the local gate.

No Databricks profile is needed for this path.

## Create from real assets

1. Confirm the selected profile, bounded source scope, business goal, and whether sampling is authorized.
2. Follow [semantic-discovery.md](semantic-discovery.md): existing-view overlap, metadata inventory, authorized sampling, source grain, relationships, fields, and measures.
3. For live retrieval, follow [live-discovery-operations.md](live-discovery-operations.md); do not invent CLI commands or silently skip unavailable assets.
4. Present the semantic inventory before YAML when business choices remain.
5. Draft only approved or clearly labeled semantic elements.
6. Run the local gate before proposing workspace submission.

## Design guidance

- Prefer a direct one-fact source with declarative many-to-one dimensions when that preserves the required grain.
- For multiple grains, evaluate native one-to-many branches, independent sibling fact branches, or a bridge source before proposing a separately governed pre-aggregated base view.
- Use explicit stable names; field and measure names share the output namespace.
- Define atomic measures first and use `MEASURE(...)` for composed measures.
- Record currency, unit, timezone, filter, denominator, and distinct-count semantics.
- Prefer many-to-one dimension joins. One-to-many modeling requires YAML 1.1 and Databricks Runtime 18.1 or newer on runtime compute; it cannot expose fields from those branches, cannot mix sources inside one aggregation function, and requires uniform cardinality within each nested subtree.
- Treat `rely.at_most_one_match` as a directional, unvalidated correctness promise for either cardinality.
- Add `comment`, `display_name`, `format`, and genuine `synonyms` when the target supports agent metadata.
- Do not humanize codes without an authoritative mapping.
- Avoid materialization until query patterns justify it; parameterized metric views cannot be materialized.
- Use block scalars for multiline SQL. YAML syntax success does not prove Databricks SQL success.

Current patterns:

- https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/yaml-reference
- https://github.com/databricks/databricks-agent-skills/tree/main/plugins/databricks/claude/skills/databricks-metric-views

Current Databricks documentation is authoritative when a skill snapshot differs.
