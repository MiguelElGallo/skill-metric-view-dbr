# Supported YAML and feature matrix

This is a checker routing reference, not a replacement for Databricks documentation. Rules were verified against current Databricks documentation on 2026-08-29.

## Top level

`version` and `source` are required. Define at least one `fields`/`dimensions` entry or measure. Supported top-level keys:

- `version`: exactly `0.1` or `1.1`; canonical unquoted numeric-looking forms are accepted.
- `source`: a table-like Unity Catalog asset or SQL query.
- `comment`, `parameters`, `filter`, `joins`, `fields`, `dimensions`, `measures`, `materialization`.

`fields` is preferred; `dimensions` remains an accepted synonym. Simultaneous use is flagged because current documentation does not specify its analyzer behavior clearly.

## Feature availability

| Feature | YAML spec | Minimum DBR |
| --- | --- | --- |
| Base metric views | 0.1 or 1.1 | 16.4 |
| Agent metadata (`comment`, `display_name`, `format`, `synonyms`) | 1.1 | 17.3 |
| Nested snowflake joins | 0.1 or 1.1 | 17.3 |
| Materialization | 0.1 or 1.1 | 17.3 |
| Join `cardinality` and `one_to_many` | 1.1 | 18.1 |
| `rely.at_most_one_match` | documented independently | 18.1 |
| Window `offset` and inclusive/exclusive modifiers | 1.1 | 18.1 |
| Parameters | documented independently | 18.2 |
| Field and measure wildcards | 1.1 | 18.2 |
| Parameterized window sizes | as required by the feature | 18.2 |
| Unitless numeric-index window ranges and offsets | 1.1 | 19 |

SQL warehouses run an automatically updated Databricks SQL version. Do not pretend a user-selected DBR number applies to them.

## Locally enforced relationships

- Joins require exactly one of `on` or `using`.
- Wildcard imports contain only `expr`; `COUNT(*)` is not a wildcard import.
- Explicit field and measure names are unique across the output namespace.
- Parameter defaults, once started, continue for every following parameter.
- Window definitions require `order`, `range`, and `semiadditive`.
- Dated window ranges and offsets use day, month, or year units. DBR 19 also supports unitless numeric ranges and offsets over consecutive integer order fields; index density and grain still require live data validation.
- Parameterized metric views cannot be materialized.
- Materialization uses `mode: relaxed`, unique entries, valid aggregated/unaggregated combinations, and `dimensions` for field references.
- `rely.at_most_one_match` is warned because its data truth is not runtime-validated.

Current sources:

- https://docs.databricks.com/aws/en/uc-semantics/metric-views/yaml-reference
- https://docs.databricks.com/gcp/en/uc-semantics/metric-views/feature-availability
- https://docs.databricks.com/aws/en/uc-semantics/agent-metadata
- https://docs.databricks.com/aws/en/uc-semantics/metric-views/materialization
