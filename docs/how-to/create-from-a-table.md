# Create a metric view from a real table

Use the skill to discover what a table means before it writes YAML. The result is stronger when the skill can combine business questions, Unity Catalog metadata, and a small authorized sample.

## Decide what the skill may inspect

Choose one of these scopes:

- **Metadata only:** names, types, comments, tags, and declared keys. No table rows.
- **Metadata and bounded sampling:** the same metadata plus selected value shapes, distributions, nulls, and relationship evidence.
- **Additional business assets:** supplied SQL, KPI files, dashboards, or a Genie Agent. Name each asset explicitly.

Sampling reads actual data. Bound both the returned rows and the work: choose a sample fraction or bucket, warehouse, estimated scan cap, profiling-query cap, timeout, and sensitive exclusions.

## Ask for semantic discovery first

Open a writable project folder in VS Code. Then paste:

~~~text
Use the databricks-metric-view skill.

Business goal: <questions this metric view must answer>
Databricks profile: <PROFILE>
Source scope:
- <catalog.schema.fact_table>
- <catalog.schema.dimension_table, if needed>
Target compute: <SQL warehouse or Databricks Runtime version>
Target schema: <catalog.schema>

You may inspect Unity Catalog metadata for those sources.
Use warehouse <WAREHOUSE_ID> for read queries.
You may run deterministic 0.1 percent samples with seed 42.
Return at most 100 rows per table, run at most 8 profiling queries, and allow 30 seconds per query.
Do not run a sample whose estimated scan exceeds 1 GB; if the estimate is unavailable, stop and ask.
Keep aggregate profiling on the sampled relation.
Exclude tagged or plausibly sensitive columns from raw sample output.
Do not inspect query history, dashboards, or Genie assets.

Before writing YAML:
1. check for overlapping metric views in the target schema;
2. retrieve every column and existing comment for every source table;
3. state each table's likely purpose and one-row grain;
4. classify every source column as include, exclude, or defer, with a reason;
5. show question coverage, candidate keys, relationships, fields, measures, filters, and complete measure contracts;
6. label each item business-authoritative, governed metadata, observed, or inferred;
7. reuse applicable current terminology, but keep inferred comments, display names, formats, synonyms, formulas, and code labels outside YAML until I approve them;
8. list the business questions that still need my decision.

Save the approved draft as <file name>, check it, and do not deploy.
~~~

If there is no target schema yet, omit the overlap step. If you want metadata only, replace the sampling lines with:

~~~text
Metadata only. Do not read table rows or run data-profiling queries.
~~~

## Give the skill business evidence

Column names are not business definitions. Add any evidence you trust:

~~~text
Use these approved definitions:
- An order is counted distinctly by order_id.
- Revenue is SUM(net_amount), in EUR, excluding cancelled orders.
- customer_id joins orders to customers.

Use the attached KPI file and trusted reconciliation SQL as authoritative.
Treat names inferred from columns as proposals.
~~~

You can also attach a SQL file, KPI sheet, dashboard export, or data dictionary. The skill should record which source supports each suggestion and surface conflicting definitions.

## Review the semantic inventory

Before YAML, expect a summary containing:

- source tables, their likely roles, and row grain;
- a complete include/exclude/defer ledger for every bounded source column;
- declared and tested keys;
- candidate relationships and whether cardinality was tested;
- fields users can group or filter by;
- atomic and composed measures, with units and filters;
- useful comments, display names, justified formats, and genuine synonyms, with approval status;
- sensitive exclusions;
- existing-view overlap;
- evidence, confidence, and open questions.

A sampled value distribution is observed evidence. It is not proof of business meaning or full-table cardinality. A catalog comment or declared key is governed metadata, not automatically an approved business definition. Copying a comment to a transformed field or new metric is a new assertion unless it still describes exactly the same meaning.

## Resolve only meaningful questions

Answer questions that change the metric:

- gross or net amount;
- event date or posting date;
- order count or line count;
- currency and timezone;
- cancelled-row treatment;
- distinct key and join cardinality.

The skill should batch these questions. It should not stop for routine formatting or metadata reads already in scope.

## Ask for the draft

After you approve the semantic choices:

~~~text
Use the approved inventory to create the smallest semantically complete metric view for the agreed questions.
Define atomic measures first, then compose reusable ratios with MEASURE(...).
Add approved comments and display names to every explicit field and measure.
Add justified formats and only genuine, unambiguous synonyms.
Save and check the complete definition. Do not deploy.
~~~

For an existing file, continue with [Review an existing metric view](review-an-existing-view.md). To create the real object, use [Deploy and verify a metric view](deploy-a-view.md).
