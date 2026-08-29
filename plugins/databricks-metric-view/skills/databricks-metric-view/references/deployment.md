# Live validation and deployment

Use this reference only when the user requests live analyzer proof or deployment.

## Resolve context

1. Verify Databricks CLI availability.
2. Honor the selected profile. If none was selected, list profiles with their hosts and ask once; never auto-select.
3. Confirm host and current user without printing credentials.
4. Resolve the SQL warehouse and fully qualified target.
5. Read the target state with `DESCRIBE TABLE EXTENDED <fully-qualified-target> AS JSON` before choosing DDL. Verify the returned catalog, schema, name, type, owner, and `view_text`. Use `ALTER VIEW` only when the exact target exists, its type is `METRIC_VIEW`, and the current principal owns it. If another object type or owner is returned, stop.
6. Confirm whether the intent is create-only, update-preserving, or identity-resetting replacement.
7. Run the local checker against the exact YAML payload that will be submitted.

## Choose the safe DDL

- **New target:** verify it is absent, then use the complete form below. Stop if it exists.
- **Existing metric view:** default to `ALTER VIEW <target> AS $$<complete YAML>$$`. The caller must own the view. Include the complete definition; this preserves grants and `table_id`.
- **Explicit reset:** use `CREATE OR REPLACE VIEW` only when the user explicitly accepts that Databricks treats it as drop-and-create and does not preserve the original grants or `table_id`.

Do not drop an existing object as an implementation detail of an update.

For a new target, keep every required clause:

~~~sql
CREATE VIEW `<catalog>`.`<schema>`.`<view>`
WITH METRICS
LANGUAGE YAML
AS $$
<exact checked YAML>
$$
~~~

Backtick-quote each catalog, schema, and object component independently in executable SQL, and escape an embedded backtick by doubling it. Do not quote a three-part name as one identifier. Require table-like YAML sources and relations inside SQL-query sources to be fully qualified.

## Preserve YAML exactly

Write the exact checked YAML and complete statement to temporary files. Do not reformat or reconstruct the YAML after checking it. Send the SQL file's bytes through the stable Statement Execution API.

Do not use `databricks experimental aitools tools query` for metric-view YAML DDL. Its command-line argument path is useful for ordinary ad-hoc SQL, but it is not a byte-preserving transport for a multiline YAML body. Avoid any other helper that serializes or flattens text inside `$$ ... $$`.

Check the payload immediately before wrapping it:

~~~bash
<plugin-root>/bin/checker.cmd check definition.yml \
  --format json \
  --compute sql-warehouse
~~~

Then put those unchanged bytes between the delimiters and submit:

~~~bash
jq -Rs \
  --arg warehouse_id "<WAREHOUSE_ID>" \
  --arg catalog "<CATALOG>" \
  --arg schema "<SCHEMA>" \
  '{warehouse_id: $warehouse_id, catalog: $catalog, schema: $schema, statement: .}' \
  definition.sql > statement.json

databricks api post /api/2.0/sql/statements/ \
  --profile <PROFILE> \
  --json @statement.json
~~~

Poll a pending statement by its original statement ID until it reaches a terminal state. A timeout or interrupted response can leave the statement running; do not submit another statement when the outcome is unknown. Keep payloads outside the repository and remove them after use.

Treat each submission as a deliberate analyzer attempt. Only a deterministic YAML or DDL parser/analyzer error permits a payload correction: stop, identify one justified correction, rerun the local checker against the complete changed payload, and only then submit a new attempt. Permission or ownership errors, an existing or wrong target type, profile/warehouse/namespace mismatch, transport failure, timeout, and unknown outcomes do not permit payload changes or resubmission. Resolve the context or poll the original statement. Do not cycle through guessed wrapper or indentation variants.

## Analyzer canary

When the user asks for live analyzer proof without final deployment, prefer a uniquely named temporary metric view in an isolated SQL session when supported. Explain what it will create and clean up. Do not use a persistent final target merely for validation.

A temporary, unqualified canary proves parser/analyzer behavior and source resolution only in that session. It does not prove `CREATE` or `ALTER` permission, ownership, grants, or behavior in the final catalog and schema. Only an authorized statement against the persistent target proves that target's permission context.

## Deployment acceptance

After successful creation or update:

1. Read back `view_text`, parse it as YAML, and compare the complete tree with the checked payload: version, source, comment and agent metadata, fields or dimensions, measures, joins, filters, parameters, windows, and materialization. Databricks can canonicalize formatting, so compare parsed meaning rather than whitespace alone.
2. Query explicit fields and every important measure with `MEASURE(...)`; `SELECT *` is not supported for measure evaluation.
3. For a parameterized metric view, supply representative named arguments and invoke it as a table-valued function. Report the exact invocation.
4. Compare correctness-sensitive totals, grouped results, and filters with trusted SQL when available. Match the source snapshot or as-of time, timezone, parameters, filters, grouping keys, null and zero-denominator behavior, rounding, and agreed absolute and relative tolerances.
5. Re-test relationship grains likely to reveal fan-out.
6. If the definition has materializations, run `DESCRIBE EXTENDED <target>` and record the latest refresh status, latest refresh link/time when available, and schedule. Materializations refresh asynchronously; an update or schedule change does not itself guarantee a new refresh.
7. Run `EXPLAIN EXTENDED` for each reconciliation query and record whether the plan used a `__materialization_mat_...` leaf or fell back to source data. In `relaxed` mode, rewrite does not check freshness, SQL settings, or determinism.
8. Align trusted SQL to the materialization's snapshot when rewrite occurred. If that cannot be done, state that the materialized path was not reconciled. If the query fell back to source, state that only the source path was tested.
9. Report profile, host, warehouse, target, statement result, smoke result, definition reconciliation, materialization freshness/rewrite reconciliation, and cleanup separately.

Analyzer acceptance, a successful smoke query, definition correctness, and materialization correctness are separate claims. Do not trigger `REFRESH MATERIALIZED VIEW` merely to complete validation; refresh is a state-changing, billable operation that needs explicit authorization.

References:

- https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial
- https://docs.databricks.com/aws/en/sql/language-manual/sql-ref-syntax-ddl-create-view
- https://docs.databricks.com/aws/en/uc-semantics/metric-views/manage
- https://docs.databricks.com/aws/en/uc-semantics/metric-views/query
