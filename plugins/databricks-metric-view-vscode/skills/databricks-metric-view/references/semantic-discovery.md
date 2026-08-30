# Semantic discovery from Databricks assets

Read this reference when creating a metric view from real tables or improving the business semantics of an existing definition.

The goal is not to expose every column. The goal is to review every bounded source column and produce the smallest semantically complete set of fields, measures, joins, filters, and metadata that answers the agreed business questions.

## Establish the scope

Resolve these inputs from the request. Ask once for missing items that materially change the work:

- Databricks profile and exact workspace.
- Source catalog, schema, and tables.
- Business domain, questions, and intended consumers.
- Target compute and target schema when known.
- Whether the task is review-first or may continue to deployment.
- Whether actual data sampling is authorized, including tables, columns, sample percentage or row bucket, estimated bytes or rows scanned when available, maximum returned rows, maximum profiling-query count, per-query timeout, warehouse, and sensitive-data exclusions.
- Any supplied evidence: KPI files, trusted SQL, dashboards, Genie Agent, data dictionary, or business glossary.
- Whether a supplied list is exhaustive. Treat named columns and measures as required seeds unless the user says `only` or `exactly`, supplies a complete authoritative specification, or explicitly requests a structural smoke test.

Never auto-select a profile. Keep every CLI command on the selected `--profile`.

## Classify evidence and record provenance

Keep provenance on every proposed semantic element:

| Class | Examples | How to use it |
| --- | --- | --- |
| **Business-authoritative** | User-approved KPI definition, owned business glossary, certified reconciliation SQL | Use directly within its stated scope unless authorities conflict. |
| **Governed or declarative metadata** | Unity Catalog comment or tag, declared key, Genie instruction with an identifiable owner | Use as governed context. Promote it to business authority only when ownership, curation, and currentness support that claim. |
| **Observed** | Repeated query expression, dashboard filter, sampled value distribution, successful join test | Use as evidence, not as an unstated business definition. |
| **Inferred** | Column-name heuristic, fact/dimension guess, suggested synonym, possible ratio | Present as a proposal and request confirmation when it changes meaning. |

For every item, record the exact locator, owner or approving authority when known, retrieval time, and whether it appears current, stale, or in conflict. Do not assume a generated comment, technical tag, or declared key is current business truth. Prefer owned, current, business-approved definitions. Then weigh scope fit, stewardship, currentness, and conflict status; do not use asset type alone as a fixed precedence rule. Surface conflicts with all sources attached.

## Discovery workflow

### 1. Check existing semantic assets

When a target schema is in scope, list existing metric views before proposing a new one. Read their definitions and compare:

- source table or query;
- field expressions;
- measure expressions;
- joined tables;
- business purpose and metadata.

Report meaningful overlap. Prefer extending the existing view with `ALTER VIEW` when the user authorizes that exact update. Do not create a near-duplicate silently.

### 2. Inventory metadata before rows

Collect the complete metadata-only schema for every bounded source table before selecting outputs:

- catalog, schema, and table comments;
- column names, types, nullability, comments, tags, masks, and classifications visible to the caller;
- primary, foreign, and unique constraints, including `RELY` state;
- table properties, clustering or partition information, and freshness metadata;
- existing metric-view, dashboard, Genie, or KPI descriptions explicitly in scope.

Read existing table comments and every column comment before drafting descriptions. For each column, record an `include`, `exclude`, or `defer` decision and the reason. An exclusion can be correct because the column is operational, sensitive, redundant, unsupported by the questions, or semantically unresolved; it must not disappear from the review merely because it was not named in the prompt.

Use exact Unity Catalog names. In SQL, backtick-quote each identifier part that contains special characters.

Databricks primary-key, foreign-key, and unique constraints are informational. Record them as declared; do not call them data-verified. `NOT NULL` and `CHECK` constraints are enforced, but their presence still does not establish the wider business meaning of a column.

### 3. Sample only with authorization

Metadata-only work must not read table rows. The `discover-schema` helper includes sample rows, null counts, and a total row count, so do not use it for this bounded workflow unless full-table profiling was separately authorized.

Before the first sample query, state:

- tables and columns;
- warehouse, sampling method, percentage or row bucket, and seed;
- estimated scan bound when Databricks exposes enough statistics to estimate it;
- maximum rows returned;
- maximum profiling-query count and per-query timeout;
- whether aggregates such as distinct counts or join coverage will run, and that they stay on the sampled relation;
- sensitive columns that will be excluded or redacted.

Prefer deterministic, bounded samples:

~~~sql
SELECT <approved_columns>
FROM <catalog.schema.table>
TABLESAMPLE (<approved_percent> PERCENT) REPEATABLE (42)
LIMIT 100
~~~

Choose and disclose the percentage and row cap in proportion to the table and request. `LIMIT 100` bounds output, not the work Databricks may perform. `TABLESAMPLE (n ROWS)` behaves like `LIMIT` rather than a random sample; use a percentage when randomness matters. If a credible scan estimate is unavailable, say so and choose a conservative percentage or bucket. Stop when the approved query count or timeout is reached.

For semantic shape, query the sampled relation rather than returning raw rows:

~~~sql
WITH sampled AS (
  SELECT <approved_columns>
  FROM <catalog.schema.table>
  TABLESAMPLE (<approved_percent> PERCENT) REPEATABLE (42)
)
SELECT
  <candidate_category>,
  COUNT(*) AS sample_rows
FROM sampled
GROUP BY <candidate_category>
ORDER BY sample_rows DESC
LIMIT 25
~~~

Inspect only what can change the design:

- categorical values, nulls, and approximate cardinality;
- numeric range, sign, scale, likely currency or units;
- date range, timezone clues, and useful grains;
- identifier shape and duplicate evidence;
- code values that need an authoritative label mapping;
- freshness and obvious sentinel values.

Run aggregate profiling against the sampled common table expression, not the full source, unless full profiling was separately authorized. Do not persist raw samples unless the user asks. Do not include sensitive values in reports or project files. A sample shows shape, not full-table truth.

### 4. Identify table purpose and grain

For each source table, record:

- likely role: fact, dimension, bridge, snapshot, aggregate, or unknown;
- one-row grain in a plain sentence;
- candidate business and surrogate keys;
- event, effective, snapshot, and load timestamps;
- numeric facts, categorical attributes, and degenerate dimensions;
- evidence and confidence for every classification.

Prefer the simplest model that preserves the real grains. A direct fact source with many-to-one dimension joins is the default when one fact grain answers the questions.

When requirements span fact grains, evaluate Databricks-native designs before introducing a separate base view:

- a `one_to_many` branch for measures from a child fact table;
- independent top-level sibling `one_to_many` branches, which Databricks aggregates separately;
- a bridge source with fact branches when the bridge is the stable common grain.

Native one-to-many modeling requires YAML 1.1 and Databricks Runtime 18.1 or newer on runtime compute. It cannot expose fields from a one-to-many branch, one aggregation function cannot mix source branches, and every nested subtree must use one cardinality. Arithmetic across separately aggregated measures is allowed. Use a separately governed, pre-aggregated base view only when those restrictions or the intended semantics make the native model unsuitable.

### 5. Establish relationships safely

Track two independent axes for every proposed join:

1. **Semantic justification:** user-approved or governed definition, trusted SQL or BI asset, declared constraint, or name/type inference.
2. **Data conformance:** untested, sample-tested, or full-scope tested for uniqueness, nulls, referential coverage, and fan-out.

Neither axis proves the other. Matching names do not prove conformance, and a clean sample does not prove the business relationship or full-table cardinality.

When data profiling is authorized, test the minimum needed:

- parent-key uniqueness;
- child-key null rate;
- unmatched child-key rate;
- rows before and after the join;
- for `many_to_one`, maximum joined-row matches per stable source-row identity, which must be at most one before asserting the `RELY` promise.

When stable row identities are unavailable, test full join-key uniqueness in the relevant direction and label the limitation. Keep sample-tested and full-scope-tested conformance distinct.

For slowly changing or snapshot dimensions, also test active-row uniqueness per business key and confirm the intended temporal or as-of join. A business key that is unique only within an effective-time range is not an ordinary many-to-one join.

Use bounded samples first. Ask before a full-table reconciliation that may be expensive. Label untested relationships as candidates. Do not set `rely.at_most_one_match: true` on a one-to-many join or from naming or sampled evidence alone.

### 6. Select fields

Prefer fields that users group, filter, or explain results by:

- governed categories and statuses;
- raw dates plus only the business-relevant date grains;
- useful geographic, product, customer, or organizational attributes;
- joined dimension attributes with a justified relationship;
- identifiers only when consumers genuinely need them.

Do not expose tagged sensitive columns by default. Humanize codes only when the mapping is documented or confirmed. Preserve raw values when the meaning is unresolved.

For every field, record expression, source, description, display name, genuine synonyms, null behavior, and evidence class.

Maintain a complete column coverage ledger:

| Source column | Decision | Reason | Candidate output | Evidence or open question |
| --- | --- | --- | --- | --- |
| `<column>` | Include / Exclude / Defer | `<reason>` | `<field or measure>` | `<locator or question>` |

Derived fields must also record how the transformation changes the source meaning. A source comment cannot be copied unchanged to `DATE_TRUNC`, `CASE`, `COALESCE`, a renamed output, or another transformation unless it still describes the result.

### 7. Define measures from business evidence

Start from a question, KPI, or trusted SQL—not merely from numeric types.

For each measure, record:

- business definition and intended grain;
- aggregation expression;
- source columns and filters;
- unit, currency, timezone, and sign convention;
- distinct-count key when applicable;
- numerator and denominator semantics for ratios;
- additivity or semi-additivity across time and other dimensions;
- null and zero-denominator behavior;
- expected behavior across dimensions;
- authoritative comparison query when available.

Define reusable atomic measures first, then compose ratios with `MEASURE(...)`. Treat filtered, semi-additive, snapshot, and window measures as business decisions. Do not sum a pre-aggregated column or mix currencies without explicit semantics.

### 8. Reconcile other sources

When the user supplies or authorizes them:

- **Trusted SQL:** extract source tables, joins, aggregations, filters, groupings, aliases, and comments.
- **KPI or data-dictionary files:** preserve approved names, formulas, units, owners, and descriptions.
- **AI/BI dashboards:** extract dataset SQL, widget labels, filter parameters, and repeated calculations.
- **Genie Agents:** inspect approved descriptions, synonyms, join instructions, example questions, and benchmark SQL.
- **Query history:** mine only when explicitly authorized; treat frequency as usage evidence, not correctness.

Deduplicate by normalized expression and business meaning. Record each contributing source. A conflict such as “gross amount” versus “net amount” is a question, not an opportunity to choose silently.

### 9. Enrich every included semantic element

Databricks exposes durable semantic metadata through `comment`, `display_name`, `synonyms`, and `format` in YAML 1.1 on supported compute. Treat enrichment as required production work even though each property is optional in the Databricks schema.

For the view and every explicit field or measure:

1. Read business-authoritative and governed descriptions, comments, display labels, aliases, glossary terms, tags, KPI definitions, Genie instructions, and trusted SQL that are in scope.
2. Reuse an existing definition only when it applies to the same semantic element, is sufficiently current and owned, and has no unresolved conflict.
3. Draft a concise durable `comment` that explains business meaning, scope, grain, filters, and units as applicable.
4. Add a user-facing `display_name`. Mechanical title casing can proceed when it adds no meaning; renamed business concepts require evidence or approval.
5. Review the consumers' vocabulary and add only genuine, unambiguous `synonyms`. Synonyms are imported into Genie, so a false alias is worse than no alias. Do not turn every SQL alias or dashboard label into a synonym automatically.
6. Add `format` only from known type and presentation semantics. Currency, percentage scale, timezone, sign convention, and unit are business assertions, not cosmetic guesses.
7. Humanize code values only from an approved or documented mapping. Observing `O`, `P`, or `F` in a sample does not establish their labels.

Preservation is not endorsement. Copying metadata into a transformed field, filtered measure, ratio, window, renamed output, or different object is a new assertion and needs scope validation.

When terminology is absent or conflicting, keep the proposal outside deployable YAML:

| value | yaml_path | evidence_class | locator | owner/currentness | status |
| --- | --- | --- | --- | --- | --- |
| `<proposed text>` | `$.fields[0].comment` | Inferred | `<source>` | `<owner/status>` | proposed |

Use `proposed`, `approved`, or `rejected`. Ask once for the unresolved business choices before moving approved values into YAML. A request to deploy is not approval to invent a formula, join, unit, code label, description, or synonym. Broad instructions such as `use whatever seems reasonable`, `use your best judgment`, or `do not ask` allow proposal drafting only. Exact critical values require current authoritative evidence or explicit acceptance after the proposal is shown.

### 10. Present a semantic inventory before YAML

For every production-intended real-asset creation, record and show a compact inventory before YAML:

| Area | Candidate | Evidence and locator | Owner/currentness | Confidence | Open question |
| --- | --- | --- | --- | --- | --- |
| Source grain | One row per order | Certified SQL at `<path>` | Finance Analytics; current | High | None |
| Field | Order status | UC comment on `<catalog.schema.table.column>` plus observed values | Owner unknown; retrieved `<time>` | Medium | Confirm code labels |
| Measure | Total revenue | Approved KPI SQL at `<path>` | Finance; current | High | Currency is USD? |
| Join | Orders to customer | Declared foreign key; conformance untested | Platform metadata; retrieved `<time>` | Medium | Authorize cardinality test? |

Cover:

- existing-view overlap;
- source tables, roles, grains, and keys;
- every bounded source column with an include, exclude, or defer decision;
- relationships and validation status;
- candidate fields, measures, and filters;
- comments, display names, formats, synonyms, approval status, and provenance;
- sensitive exclusions;
- gaps and unresolved business questions.

Before deployable YAML, also show question coverage and complete measure contracts. Keep any critical inferred or conflicting grain, formula, unit, filter, distinct key, join meaning, cardinality, or code mapping out of the definition. Do not force approval for routine metadata collection, preservation of applicable current metadata, or mechanical display formatting.

## Semantic readiness decision

Mark a production-intended view ready only when:

- the agreed questions map to fields, measures, and filters;
- source role, grain, keys, and time behavior are recorded;
- the column coverage ledger has no unexplained omission;
- each measure contract is complete for every applicable attribute;
- relationships have separate semantic-justification and data-conformance statuses;
- every explicit output has an approved comment and display name;
- applicable formats are justified and genuine consumer vocabulary was reviewed for synonyms;
- exclusions, sensitive fields, conflicts, and gaps are visible.

There is no minimum count. A two-field view can be ready for a genuinely narrow purpose; a fifty-field view can fail readiness when meanings are missing. An explicit installation or structural smoke can proceed without this gate only when it is labeled non-production and its proof objective is recorded.

## Validate meaning after deployment

A smoke query proves that the view can run, not that the metrics are correct.

When trusted SQL or expected results exist:

1. Query every important measure at the total grain.
2. Query it across representative fields and filters.
3. Make the compared queries genuinely comparable: use the same source snapshot or as-of time, timezone, parameters, filters, grouping keys, and null and zero-denominator behavior.
4. Compare with agreed absolute and relative tolerances, plus matching rounding rules.
5. Re-test joins at grains likely to reveal fan-out.
6. For parameterized views, invoke the view as a table-valued function with explicit representative arguments and report the exact call.
7. Treat any unexplained mismatch as a failure.

When the user supplies trusted natural-language question and SQL pairs, run each pair against the deployed metric view or explicitly scoped Genie surface, compare the generated or metric-view result with the trusted SQL, and report exact differences. Keep these benchmark changes separate from unrelated structural fixes so a passing schema check cannot hide a behavioral regression.

For a materialized definition, also:

- read `DESCRIBE EXTENDED <metric_view>` and record latest refresh status, latest refresh link/time when available, and schedule;
- use `EXPLAIN EXTENDED` to record whether each reconciliation query rewrote to a `__materialization_mat_...` leaf or used the live source;
- align the trusted comparison to the materialization snapshot when rewrite occurred;
- state when only the live-source fallback was tested or when the stored path could not be reconciled;
- report definition correctness separately from materialization freshness and rewrite correctness.

`relaxed` rewrite does not verify freshness, SQL settings, or determinism. Metric-view updates refresh materializations asynchronously, and changing a schedule does not trigger a refresh. Do not trigger a manual refresh without explicit authorization.

Report platform acceptance, smoke-query success, and business reconciliation separately.

## Sources

Workflow ideas were adapted for Databricks from:

- [Snowflake semantic view skill](https://github.com/MiguelElGallo/snowflake-semantic-view-skill)
- [Databricks metric-view advisor](https://github.com/databricks/databricks-agent-skills/tree/main/plugins/databricks/claude/skills/databricks-metric-views)

Databricks references:

- [TABLESAMPLE](https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-qry-select-sampling)
- [Unity Catalog key column usage](https://docs.databricks.com/aws/en/sql/language-manual/information-schema/key_column_usage)
- [Metric-view YAML reference](https://learn.microsoft.com/en-us/azure/databricks/uc-semantics/metric-views/yaml-reference)
- [Agent metadata for metric views](https://docs.databricks.com/aws/en/uc-semantics/agent-metadata)
- [Databricks TPC-H metric-view tutorial](https://docs.databricks.com/aws/en/uc-semantics/metric-views/tpch-example)
