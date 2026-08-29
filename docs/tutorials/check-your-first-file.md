# Check your first metric-view file

In this tutorial, we will check one valid file and then see the checker catch a mistake. Nothing is sent to Databricks.

You need Node.js 20 or newer and a local copy of this repository.

## Check a working example

From the repository root, run:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  tests/fixtures/valid/basic-fields.yml \
  --compute sql-warehouse
```

The first line should look like this:

```text
PASS ... (0 errors, 0 warnings, 1 info)
```

Notice the final disclaimer. The checker has confirmed the local rules, not Databricks acceptance.

## See a useful error

Now run the checker against a definition with a repeated YAML key:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  tests/fixtures/invalid/duplicate-key.yml
```

The output starts with `FAIL` and points to the line and column of the problem. The process exits with code `1`, which means a validation finding was found.

You have now used the same validation engine that the plugin exposes to an agent. Next, [create your first metric view](create-your-first-metric-view.md).
