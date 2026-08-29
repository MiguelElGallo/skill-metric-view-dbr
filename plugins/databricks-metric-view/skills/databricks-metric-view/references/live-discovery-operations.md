# Live discovery operations

Read this reference only for semantic discovery against a Databricks workspace. It turns the evidence workflow in [semantic-discovery.md](semantic-discovery.md) into explicit, read-only operations.

Use the smallest applicable section. Do not fetch dashboards, Genie spaces, query history, or table rows unless those surfaces are explicitly in scope.

## Verify the selected connection

Never choose a profile by recency or name. Require the profile from the request, then verify it without printing credentials:

~~~bash
databricks --version
databricks auth describe --profile <PROFILE>
databricks current-user me --profile <PROFILE> -o json
~~~

Confirm that the returned host is the intended workspace. On failure, report the command and error category—missing CLI, unknown profile, expired login, wrong host, or insufficient permission—and stop live discovery. Do not fall back to another profile.

Honor a warehouse ID supplied by the user. Otherwise, first check whether the installed CLI exposes the default-warehouse helper:

~~~bash
databricks experimental aitools tools get-default-warehouse --help
databricks experimental aitools tools get-default-warehouse --profile <PROFILE> -o json
~~~

The `experimental` surface can change. If it is unavailable, list warehouses and ask the user to select one; do not pick an arbitrary warehouse:

~~~bash
databricks warehouses list --profile <PROFILE> -o json
databricks warehouses get <WAREHOUSE_ID> --profile <PROFILE> -o json
~~~

Record the profile, verified host, current user, warehouse ID, warehouse state, CLI version, and retrieval time in the evidence log.

## Run bounded read SQL

If the installed CLI confirms this helper, use it for short metadata reads that do not have a strict runtime cap:

~~~bash
databricks experimental aitools tools query --help
databricks experimental aitools tools query "<READ_ONLY_SQL>" \
  --warehouse <WAREHOUSE_ID> \
  --profile <PROFILE> \
  --output json
~~~

The helper exposes no per-query timeout flag in CLI v1.14.0. Do not use it for sampling or profiling with an approved deadline. Route those statements directly through the stable Statement Execution API with cancellation on timeout. Also use the API when the helper is absent or its output is unsuitable for deterministic parsing:

1. Put one read-only SQL statement in a temporary `.sql` file outside the repository.
2. Create the request without hand-escaping the statement:

~~~bash
jq -n \
  --rawfile statement <TEMP_SQL_FILE> \
  --arg warehouse_id <WAREHOUSE_ID> \
  '{warehouse_id: $warehouse_id, statement: $statement, wait_timeout: "30s", on_wait_timeout: "CANCEL", disposition: "INLINE", format: "JSON_ARRAY"}' \
  > <TEMP_REQUEST_JSON>

databricks api post /api/2.0/sql/statements/ \
  --profile <PROFILE> \
  --json @<TEMP_REQUEST_JSON>
~~~

Set `wait_timeout` to the approved deadline, from 5 through 50 seconds, and keep `on_wait_timeout: "CANCEL"`. `wait_timeout` by itself only bounds synchronous waiting and defaults to continuing the query.

3. A bounded statement should finish or be canceled at that deadline. If a response is unexpectedly still pending, poll only until the same wall-clock deadline:

~~~bash
databricks api get /api/2.0/sql/statements/<STATEMENT_ID> --profile <PROFILE>
~~~

Then cancel it explicitly rather than polling indefinitely:

~~~bash
databricks api post /api/2.0/sql/statements/<STATEMENT_ID>/cancel --profile <PROFILE>
~~~

4. Parse column names from `manifest.schema.columns` and rows from `result.data_array`. Follow `result.next_chunk_internal_link` with `databricks api get "<NEXT_CHUNK_INTERNAL_LINK>" --profile <PROFILE>` until absent; never treat the first chunk as a complete result when a next link exists.
5. On a failed or canceled statement, retain the statement ID and error message, classify the surface as unavailable, and do not infer missing metadata.
6. Remove temporary SQL, response, and request files after extracting the bounded evidence.

Keep identifiers separate from string literals. Backtick-quote each catalog, schema, table, and column identifier part; escape schema/table names used as SQL string values. Never interpolate untrusted text into an unrestricted statement.

## Discover existing metric views

Do this before proposing a new view when a target schema is known. Metric views appear in `information_schema.tables` as `METRIC_VIEW`; they are not found reliably through `SHOW VIEWS`.

~~~sql
SELECT table_catalog, table_schema, table_name, table_owner, comment, last_altered
FROM `<TARGET_CATALOG>`.information_schema.tables
WHERE table_schema = '<TARGET_SCHEMA>'
  AND table_type = 'METRIC_VIEW'
ORDER BY table_name
~~~

For each result, run:

~~~sql
DESCRIBE TABLE EXTENDED `<CATALOG>`.`<SCHEMA>`.`<METRIC_VIEW>` AS JSON
~~~

Parse the returned JSON rather than scraping formatted text. Capture the complete view definition and each output column's `is_measure` flag. Build a structural fingerprint from source, fields or dimensions, measures, and joined tables. If the JSON layout differs from the expected CLI snapshot, preserve the raw result, report the parsing gap, and do not guess a definition. If one describe fails, report that view separately and continue the bounded inventory.

## Inventory source metadata

Start with metadata-only SQL. These operations must not select source rows.

Catalog and schema business context, ownership, and currentness:

~~~sql
SELECT catalog_name, catalog_owner, comment, created, last_altered
FROM system.information_schema.catalogs
WHERE catalog_name = '<CATALOG>'
~~~

~~~sql
SELECT catalog_name, schema_name, schema_owner, comment, created, last_altered
FROM `<CATALOG>`.information_schema.schemata
WHERE schema_name = '<SCHEMA>'
~~~

Table and column inventory:

~~~sql
SELECT table_catalog, table_schema, table_name, table_type, table_owner,
       comment, created, created_by, last_altered, last_altered_by
FROM `<CATALOG>`.information_schema.tables
WHERE table_schema = '<SCHEMA>'
  AND table_name IN ('<TABLE_1>', '<TABLE_2>')
ORDER BY table_name
~~~

~~~sql
SELECT table_catalog, table_schema, table_name, ordinal_position,
       column_name, full_data_type, is_nullable, comment
FROM `<CATALOG>`.information_schema.columns
WHERE table_schema = '<SCHEMA>'
  AND table_name IN ('<TABLE_1>', '<TABLE_2>')
ORDER BY table_name, ordinal_position
~~~

Declared keys and constraints:

~~~sql
SELECT tc.table_catalog, tc.table_schema, tc.table_name,
       tc.constraint_name, tc.constraint_type,
       kcu.column_name, kcu.ordinal_position
FROM `<CATALOG>`.information_schema.table_constraints AS tc
LEFT JOIN `<CATALOG>`.information_schema.key_column_usage AS kcu
  ON tc.constraint_catalog = kcu.constraint_catalog
 AND tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = '<SCHEMA>'
  AND tc.table_name IN ('<TABLE_1>', '<TABLE_2>')
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position
~~~

For exact foreign-key targets, also read `referential_constraints` and `constraint_column_usage` in the same catalog information schema. Record primary-key, foreign-key, and unique constraints as declarations, not data conformance. Record `NOT NULL` and `CHECK` separately because Databricks enforces them.

`information_schema.table_constraints` does not expose `RELY` state. Retrieve the creation statement for each source table through the same bounded read-SQL mechanism:

~~~sql
SHOW CREATE TABLE `<CATALOG>`.`<SCHEMA>`.`<TABLE>`
~~~

Parse primary-key, foreign-key, and unique clauses—including inline or unnamed constraints—for explicit `RELY` or `NORELY`. Preserve this as declared metadata only. Do not print raw DDL that contains sensitive locations or properties; retain the constraint clauses and redact unrelated literals. If `SHOW CREATE TABLE` is unavailable or omits the option, report `RELY` as unknown rather than defaulting it.

For table properties, statistics useful for estimating sampling work, and other table details, run these bounded metadata statements per source:

~~~sql
DESCRIBE DETAIL `<CATALOG>`.`<SCHEMA>`.`<TABLE>`
DESCRIBE TABLE EXTENDED `<CATALOG>`.`<SCHEMA>`.`<TABLE>` AS JSON
SHOW TBLPROPERTIES `<CATALOG>`.`<SCHEMA>`.`<TABLE>`
~~~

Read table and column tags only when visible to the caller:

~~~sql
SELECT catalog_name, schema_name, table_name, tag_name, tag_value
FROM `<CATALOG>`.information_schema.table_tags
WHERE schema_name = '<SCHEMA>'
  AND table_name IN ('<TABLE_1>', '<TABLE_2>')
~~~

~~~sql
SELECT catalog_name, schema_name, table_name, column_name, tag_name, tag_value
FROM `<CATALOG>`.information_schema.column_tags
WHERE schema_name = '<SCHEMA>'
  AND table_name IN ('<TABLE_1>', '<TABLE_2>')
~~~

If a tag or information-schema surface is unavailable, record the permission or feature gap. Continue with available evidence; do not silently say that no tags or constraints exist.

## Run authorized samples and profiles

Sampling authorization must name the tables and columns, warehouse, percentage or bucket, seed, returned-row cap, profiling-query cap, timeout, and sensitive exclusions. Use `DESCRIBE DETAIL` statistics to estimate scanned rows or bytes when possible and label the estimate as approximate.

Use the exact sampled relation from [semantic-discovery.md](semantic-discovery.md) for raw shape and aggregate profiles. Apply every null, distinct-count, key, and join-coverage calculation to sampled common table expressions. A raw `LIMIT` is only an output limit and does not satisfy a work bound. Stop at the approved query count or timeout. Full-source profiling requires separate authorization.

Do not use `databricks experimental aitools tools discover-schema` for metadata-only or ordinary bounded-sampling work. It returns sample rows and also computes null counts and a total row count, which can profile the full source. Use explicit sampled SQL instead.

Only when the user separately authorizes full-table profiling, confirm the command first, count its probes against the approved budget, and bind the selected warehouse for that one process:

~~~bash
databricks experimental aitools tools discover-schema --help
DATABRICKS_WAREHOUSE_ID=<WAREHOUSE_ID> databricks experimental aitools tools discover-schema \
  <CATALOG>.<SCHEMA>.<TABLE> \
  --profile <PROFILE>
~~~

## Read an AI/BI dashboard

Only fetch a dashboard named by the user or explicitly included in scope. Save the outer payload to a temporary file:

~~~bash
databricks lakeview get <DASHBOARD_ID> --profile <PROFILE> -o json > <TEMP_DASHBOARD_JSON>
~~~

Parse `serialized_dashboard` as a JSON string. Treat `datasets` as a list. Each dataset's `queryLines` is a list of strings; concatenate the elements verbatim with no separator before parsing the SQL. Do not insert whitespace or newlines: the stored elements must already contain their separators. If an element ends in a `--` comment without a newline, flag the dataset as ambiguous because it can swallow the next element. Extract dataset names, source tables, joins, aggregates, groupings, filters, parameters, page titles, and widget titles while preserving the dashboard ID and dataset locator.

An empty `datasets` or `pages` result can be a draft/published retrieval mismatch. Try, in order:

~~~bash
databricks lakeview get <DASHBOARD_ID> --profile <PROFILE> -o json > <TEMP_DRAFT_DASHBOARD_JSON>
databricks lakeview get-published <DASHBOARD_ID> --profile <PROFILE> -o json > <TEMP_PUBLISHED_DASHBOARD_JSON>
~~~

Never emit a full serialized dashboard into terminal output. Extract only the required SQL structure and labels, redact sensitive literal values or instructions from reports, and remove both temporary payloads after parsing.

If both are empty, unsupported, or forbidden, ask for the dataset or widget SQL as an attached `.sql` file. Do not interpret an empty retrieval as proof that the dashboard has no queries. Remove the temporary payload after parsing.

## Read a Genie space

Only fetch a Genie space named by the user or explicitly included in scope. Save the large outer payload before parsing:

~~~bash
databricks genie get-space <SPACE_ID> \
  --include-serialized-space \
  --profile <PROFILE> \
  -o json > <TEMP_GENIE_JSON>
~~~

Parse `serialized_space` as a JSON string. Normalize text defensively: a string remains a string; a list is flattened and joined; null remains absent. In particular:

- `data_sources.tables[].identifier` is a fully qualified source locator;
- `instructions.text_instructions[]`, `join_instructions`, and `sql_instructions` can contain nested lists of strings;
- `benchmarks.questions[].question` can be a one-element list;
- `benchmarks.questions[].answer[].content` can be a list of strings.

Extract descriptions, column descriptions and synonyms, join and SQL instructions, example questions, and benchmark SQL with exact JSON-path provenance. Do not treat Genie wording as business-approved unless its owner and curation status support that classification.

If the command, permission, or serialized payload is unavailable, ask for an exported Genie definition or its instructions and benchmark SQL. Do not invent a REST path or silently omit the source. Remove the temporary payload after parsing.

## Ingest supplied SQL and KPI files

For an attached or workspace `.sql` file, record its path and last-modified time, then extract comments, source tables, joins, aggregates, filters, grouping keys, aliases, and parameters. Reading the file is local; executing it or inspecting its tables still follows the selected profile and sampling boundaries.

For a supplied `.csv`, `.yaml`, or `.yml` KPI/data-dictionary file, record path, owner or approving authority if known, last-modified time, names, formulas, units, filters, dimensions, and descriptions. Missing formulas remain open questions; never derive an official KPI solely from its name.

Query history is a separate user-activity surface. Inspect it only when explicitly authorized with a time range, identity scope, source-table scope, and row limit. Treat recurring SQL as observed usage, not correctness. If `system.query.history` is unavailable, report that gap and continue with supplied SQL or dashboard datasets.

## Report unavailable surfaces

Never turn a failed or empty fetch into negative evidence. For each requested surface, report:

| Surface | Attempt | Result | Fallback | Evidence effect |
| --- | --- | --- | --- | --- |
| Metric views | information-schema query | permission denied | ask for definitions | overlap unknown |
| Dashboard | draft then published fetch | empty payload | request dataset SQL | dashboard semantics unavailable |
| Genie | serialized-space fetch | unsupported command | request export | Genie evidence unavailable |
| Tags | information-schema query | not visible | none | sensitivity classification incomplete |

Continue with the evidence that is available, downgrade confidence, and keep the missing surface visible in the final open questions.

## Current references

- https://docs.databricks.com/aws/en/dev-tools/cli/authentication
- https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial
- https://docs.databricks.com/aws/en/sql/language-manual/information-schema/information_schema_catalog
- https://docs.databricks.com/aws/en/uc-semantics/metric-views/
- https://github.com/databricks/databricks-agent-skills/tree/main/plugins/databricks/claude/skills/databricks-metric-views
