# Check a metric-view definition

Use this guide to stop malformed YAML before a Databricks submission.

## In an agent

Ask the agent to use the Databricks metric view skill and checker. Include the target compute when you know it:

```text
Check metric-view.yml with the Databricks metric-view checker.
The target is a SQL warehouse. Do not deploy it.
```

The tool accepts YAML text or an absolute file path.

## On the command line

For a SQL warehouse:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  metric-view.yml \
  --compute sql-warehouse
```

For a cluster running Databricks Runtime 18.2:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  metric-view.yml \
  --compute dbr \
  --runtime 18.2
```

Fix every error, then run the same command again. Warnings need review but do not make the process fail.

Use JSON in automation:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  metric-view.yml \
  --format json
```

Do not describe a local pass as “Databricks-valid.” Use [live validation](validate-and-create-a-view.md) when platform acceptance matters.
