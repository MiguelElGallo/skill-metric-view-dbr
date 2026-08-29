# What each validation level proves

Metric-view validation is divided into three levels because each one can answer different questions.

## Local checker

The local checker sees YAML text and optional compute information. It can prove that the text parses and follows the rules implemented in version 0.0.1. It is fast and works offline.

It cannot see a Databricks workspace. Its pass is deliberately narrow.

## Live context

Read-only workspace checks can confirm that a profile authenticates, a warehouse exists, a source object and columns are present, and the current identity has visible permissions.

These checks reduce uncertainty, but they still do not reproduce the full Databricks analyzer.

## Databricks analyzer and smoke query

Creating the view asks Databricks to parse and analyze the complete definition in its real catalog and compute context. A query using `MEASURE(...)` then confirms that the created object can be used.

The strongest report preserves the chain instead of collapsing it: local checks passed, live context was confirmed, Databricks accepted the definition, and the smoke query returned a result.
