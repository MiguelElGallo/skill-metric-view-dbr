# MCP tool reference

The plugin exposes one local tool through standard input and output.

## `check_databricks_metric_view_yaml`

Checks one Databricks metric-view YAML definition without connecting to Databricks.

### Arguments

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `yaml` | string | One of `yaml` or `file` | YAML text to check. |
| `file` | string | One of `yaml` or `file` | Absolute path to a YAML file. |
| `compute` | `sql-warehouse` or `dbr` | No | Compatibility target. |
| `runtime_version` | string | No | Databricks Runtime such as `18.2`; implies `dbr`. |
| `allow_unknown_fields` | boolean | No | Changes checker-unknown fields to warnings. Default: `false`. |

Exactly one of `yaml` and `file` is required. A relative `file` path is rejected because the server starts from the installed plugin directory.

### Result

The tool returns the same validation object as text content and structured content. Validation findings set `valid` to `false`; they do not turn the MCP call itself into a transport error.

### Limits

The tool does not run SQL, inspect catalogs, check permissions, read source data, prove join cardinality, or call the Databricks analyzer.
