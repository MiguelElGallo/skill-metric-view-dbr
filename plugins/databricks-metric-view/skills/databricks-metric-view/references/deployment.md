# Live validation and deployment

Use this reference only when the user requests live analyzer proof or deployment.

## Resolve context

1. Verify Databricks CLI availability.
2. Honor an explicitly selected profile. Only list `databricks auth profiles` and ask the user to choose when the profile is missing or ambiguous. Use `--profile` on every command.
3. Run `databricks auth describe --profile <PROFILE>` to confirm host and current user without printing credentials.
4. Resolve the SQL warehouse and target catalog/schema/view.
5. Confirm replace/create intent when the target already exists and the user has not already authorized replacement.

## Preserve YAML exactly

Send the complete SQL file through the stable Statement Execution API. Avoid helper paths known to flatten indentation inside `$$ ... $$` metric-view YAML.

```bash
jq -Rs --arg warehouse_id "<WAREHOUSE_ID>" \
  '{warehouse_id: $warehouse_id, statement: .}' definition.sql > statement.json

databricks api post /api/2.0/sql/statements/ \
  --profile <PROFILE> \
  --json @statement.json
```

Poll a pending statement by ID until it reaches a terminal state. Keep temporary payloads outside the repository and remove them after use.

## Safer analyzer canary

When resolving syntax uncertainty, prefer a uniquely named `TEMPORARY` metric view in an isolated SQL session when supported. Do not use a persistent target merely for validation. Record whether the canary proves only parsing/analyzer acceptance or also includes source resolution.

## Deployment acceptance

After successful creation or replacement:

1. Read back the definition with `SHOW CREATE TABLE <target>`.
2. Query explicit fields and every important measure with `MEASURE(...)`; `SELECT *` is not supported.
3. Compare correctness-sensitive metrics to trusted source SQL.
4. Report profile, host, warehouse, target, statement result, smoke-test result, and cleanup.

Do not drop an existing object unless explicitly authorized. Clean up only temporary objects created during the same task.

References:

- https://docs.databricks.com/aws/en/dev-tools/sql-execution-tutorial
- https://docs.databricks.com/aws/en/uc-semantics/metric-views/overview
