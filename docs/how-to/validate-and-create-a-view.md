# Validate and create a view in Databricks

Use this guide after the local checker passes and the user has chosen the Databricks profile, SQL warehouse, target name, and create-or-replace intent.

## Confirm the context

Check the authenticated profile and current identity:

```bash
databricks auth describe --profile PROFILE
databricks current-user me --profile PROFILE
```

Use read-only SQL to confirm the source and target schema. If the target already exists and replacement was not requested, stop and choose another name.

## Run the local gate

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  metric-view.yml \
  --compute sql-warehouse
```

Do not submit the statement if this command fails.

## Create the view

Send a statement through the Databricks Statement Execution API with this shape:

```sql
CREATE VIEW catalog.schema.view_name
WITH METRICS
LANGUAGE YAML
AS $$
...the checked YAML, with indentation unchanged...
$$
```

Use `CREATE OR REPLACE VIEW` only when replacement is explicit.

## Smoke-test a measure

Query at least one dimension and measure:

```sql
SELECT
  order_status,
  MEASURE(order_count) AS order_count
FROM catalog.schema.view_name
GROUP BY order_status
ORDER BY order_status
```

Report the profile, host, warehouse, full view name, analyzer result, and smoke-query result. The platform result is separate from the earlier local pass.
