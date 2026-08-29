# Prompt library

Copy the prompt closest to your goal and replace the angle-bracket placeholders.

## Discover semantics from real tables

~~~text
Use the databricks-metric-view skill.

Business goal: <questions to answer>
Profile: <PROFILE>
Sources: <catalog.schema.table list>
Target schema: <catalog.schema>
Target compute: <SQL warehouse or Databricks Runtime version>
Read warehouse: <WAREHOUSE_ID>
Save as: <file>

Inspect Unity Catalog metadata for those sources.
You may run deterministic 0.1 percent samples with seed 42.
Return at most 100 non-sensitive rows per table, run at most 8 profiling queries,
and allow 30 seconds per query. Do not exceed an estimated 1 GB scan per sample;
if the estimate is unavailable, stop and ask. Keep aggregates on the sampled relation.
Do not inspect query history, dashboards, or Genie assets.

Before YAML, show table roles and grain, keys, relationships, candidate fields and measures,
existing-view overlap, evidence provenance, and open business questions.
Mark every name-based inference as a proposal.
After I approve the semantics, create and check the draft. Do not deploy.
~~~

## Discover from metadata only

~~~text
Use the databricks-metric-view skill.
With profile <PROFILE>, inspect metadata for <catalog.schema.table>.
Propose a metric view for <business question>.
Do not read rows or run data-profiling queries.
Label inferred definitions as proposals.
Target <SQL warehouse or Databricks Runtime version>. Save as <file>.
Do not create or update anything in Databricks.
~~~

## Create an offline draft

~~~text
Use the databricks-metric-view skill.
Create a metric view over <catalog.schema.table> for <business question>.
Use <columns> as fields and <approved expressions> as measures.
Target <SQL warehouse or Databricks Runtime version>.
Save it as <file>.
Check it, explain assumptions, and do not connect or deploy.
~~~

## Review semantics without editing

~~~text
Use the databricks-metric-view skill to review the attached YAML.
Target <SQL warehouse or Databricks Runtime version>.
Check source grain, measure units and filters, descriptions, synonyms, joins, and overlap.
Separate definition errors, business questions, compatibility concerns, and live-only checks.
Do not edit, connect, or deploy.
~~~

## Make a focused change

~~~text
Use the databricks-metric-view skill to update the attached YAML.
Change only <requested change>.
Preserve unrelated content, ordering, comments, and evidence-backed metadata.
Check the complete result. Do not deploy.
~~~

## Deploy a new view

~~~text
Use the databricks-metric-view skill to deploy the attached definition.
Profile: <PROFILE>
SQL warehouse: <WAREHOUSE_ID>
Target: <catalog.schema.view>
Create only; stop if the target exists.
Check first, create, read back, and test the important measures.
Reconcile against the attached trusted SQL.
~~~

## Update one exact target

~~~text
Use the databricks-metric-view skill to update <catalog.schema.view>.
Profile: <PROFILE>
SQL warehouse: <WAREHOUSE_ID>
Use ALTER VIEW with the complete attached YAML so grants and object identity are preserved.
Check first, update, read back, and test it.
Do not change any other object.
~~~

## Diagnose a Databricks rejection

~~~text
Use the databricks-metric-view skill to explain this Databricks error:
<error>

Review the attached definition, make the smallest justified fix, and check it.
Do not resubmit. Stop after the revised local result and wait for an explicit deployment request.
~~~
