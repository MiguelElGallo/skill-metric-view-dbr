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

When the audit begins with a wrong Genie answer, natural-language question, or SQL result, preserve the exact input and expected behavior. Reproduce it first, identify the smallest semantic-layer gap, make only that change, and rerun the same test. Keep trusted question/SQL-pair changes separate from structural repairs unless the user asks to combine them.

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
2. Treat supplied elements as required seeds. Do not assume they are exhaustive unless the user says `only` or `exactly`, supplies a complete authoritative specification, or explicitly requests an offline structural smoke.
3. Use only supplied or clearly authoritative fields, formulas, units, filters, and relationships.
4. Keep useful but unconfirmed descriptions, synonyms, ratios, code labels, joins, and formats in a provenance-bearing suggestion inventory outside deployable YAML.
5. Start with the smallest semantically complete definition for the agreed scope and run the local gate with semantic-quality suggestions enabled.

No Databricks profile is needed for this path.

## Installation or structural smoke

Use this route only when the user explicitly asks to prove installation, package portability, transport, or analyzer acceptance:

1. Record the exact proof objective and the intentionally narrow fields and measures.
2. Do not infer that `minimal` means smoke testing.
3. Label the result non-production and do not present it as semantic coverage.
4. Run the ordinary local gate. Semantic-quality suggestions may be omitted because completeness is outside this route's proof objective.
5. If the user later asks to use the view for analytics or Genie, restart from real-asset semantic discovery.

## Create from real assets

Use this route whenever the request names a selected profile or asks to inspect accessible workspace assets. A listed output set, including one introduced with `only`, constrains the final output but does not waive complete metadata review or readiness for a production-intended view.

1. Confirm the selected profile, bounded source scope, business goal, and whether sampling is authorized.
2. Follow [semantic-discovery.md](semantic-discovery.md): existing-view overlap, metadata inventory, authorized sampling, source grain, relationships, fields, and measures.
3. For live retrieval, follow [live-discovery-operations.md](live-discovery-operations.md); do not invent CLI commands or silently skip unavailable assets.
4. Record and present the semantic inventory, complete column include/exclude/defer ledger, and readiness decision before YAML for every production-intended real-asset creation. Pause for the user only when unresolved choices remain.
5. Keep inferred or missing terminology as proposals outside deployable YAML. Databricks YAML has no durable proposal-status property, and YAML comments are not business metadata.
6. Draft only approved semantic assertions plus mechanical labels that add no new meaning.
7. Run the local gate with semantic-quality suggestions enabled before proposing workspace submission.

## Semantic readiness review

Before calling a production definition ready, verify:

- every agreed business question maps to the required fields, measures, and filters;
- every bounded source column has an include, exclude, or defer decision with a reason;
- source role, grain, keys, timestamps, and sensitive exclusions are recorded;
- every measure has the applicable formula, filters, unit, distinct key, additivity, numerator, denominator, null/zero behavior, and intended grain;
- each join has semantic evidence, declared cardinality, and a separate data-conformance status;
- every explicit output has an approved comment and display name, each applicable measure has a justified format, and vocabulary review has considered genuine synonyms;
- conflicts, exclusions, and open gaps are visible.

Do not use a numeric minimum as a proxy for quality. A small view can be semantically complete for a narrow scope. A large view can still be incomplete when it exposes unexplained fields or ambiguous measures.

## Design guidance

- Prefer a direct one-fact source with declarative many-to-one dimensions when that preserves the required grain.
- For multiple grains, evaluate native one-to-many branches, independent sibling fact branches, or a bridge source before proposing a separately governed pre-aggregated base view.
- Use explicit stable names; field and measure names share the output namespace.
- Define atomic measures first and use `MEASURE(...)` for composed measures.
- Record currency, unit, timezone, filter, denominator, and distinct-count semantics.
- Prefer many-to-one dimension joins. One-to-many modeling requires YAML 1.1 and Databricks Runtime 18.1 or newer on runtime compute; it cannot expose fields from those branches, cannot mix sources inside one aggregation function, and requires uniform cardinality within each nested subtree.
- Use `rely.at_most_one_match: true` only for a many-to-one join and treat it as an unvalidated correctness promise.
- Add `comment`, `display_name`, `format`, and genuine `synonyms` when the target supports agent metadata.
- Treat missing semantic metadata as a readiness gap, not a Databricks schema error. A local semantic-quality diagnostic is informational and cannot approve or invent terminology.
- Do not humanize codes without an authoritative mapping.
- Avoid materialization until query patterns justify it; parameterized metric views cannot be materialized.
- Use block scalars for multiline SQL. YAML syntax success does not prove Databricks SQL success.

Current patterns:

- https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/yaml-reference
- https://github.com/databricks/databricks-agent-skills/tree/main/plugins/databricks/claude/skills/databricks-metric-views

Current Databricks documentation is authoritative when a skill snapshot differs. This workflow intentionally borrows the Advisor's discovery breadth, provenance, and review-first proposal workflow, but not mandatory terminology inference, a fixed source-type precedence, automatic alias-to-synonym conversion, or unconditional code humanization.
