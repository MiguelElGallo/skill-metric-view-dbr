# Validation rules

Rules were checked against Databricks documentation on 2026-08-29.

## Always checked

- YAML 1.2 parsing, one document only, and unique keys.
- A mapping at the document root.
- Required `version` and `source` values.
- Supported top-level and nested keys.
- Required arrays, mappings, strings, and booleans.
- Unique explicit output names.
- Valid local references between fields, measures, parameters, windows, and materialization entries.
- Cross-field rules such as exactly one of join `on` or `using`.
- Known YAML specification and Databricks Runtime feature gates.

Unknown fields are errors by default. `--allow-unknown` or `allow_unknown_fields: true` changes them to warnings; it does not prove that Databricks accepts them.

## Feature gates

| Feature | YAML version | Minimum DBR on clusters |
| --- | --- | --- |
| Base metric views | `0.1` or `1.1` | 16.4 |
| Agent metadata | `1.1` | 17.3 |
| Nested joins | `0.1` or `1.1` | 17.3 |
| Materialization | `0.1` or `1.1` | 17.3 |
| Join cardinality | `1.1` | 18.1 |
| Window offset and bounds | `1.1` | 18.1 |
| Parameters and wildcards | feature-dependent | 18.2 |
| Unitless numeric windows | `1.1` | 19.0 |

SQL warehouses use an automatically updated Databricks SQL version. A DBR number is not applied to them.

## Not checked locally

- SQL expression syntax or types.
- Catalog objects and source columns.
- Permissions.
- Source data or join cardinality.
- Databricks analyzer behavior.

Current platform sources: [YAML reference](https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference), [feature availability](https://docs.databricks.com/gcp/en/uc-semantics/metric-views/feature-availability), [agent metadata](https://docs.databricks.com/aws/en/uc-semantics/agent-metadata), and [materialization](https://docs.databricks.com/aws/en/uc-semantics/metric-views/materialization).
