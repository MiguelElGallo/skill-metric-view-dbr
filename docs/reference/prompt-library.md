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

Before YAML, retrieve every source column and existing comment. Show table roles and grain,
an include/exclude/defer decision for every column, question coverage, complete measure contracts,
keys, relationships, candidate fields and measures, existing-view overlap, evidence provenance,
and open business questions. Reuse applicable current terminology. Keep every inferred comment,
display name, format, synonym, formula, code label, and relationship as an external proposal.
After I approve the semantics, create and check the draft. Do not deploy.
~~~

## Discover from metadata only

~~~text
Use the databricks-metric-view skill.
With profile <PROFILE>, inspect metadata for <catalog.schema.table>.
Propose a metric view for <business question>.
Do not read rows or run data-profiling queries.
Read the complete source schema and existing comments. Classify every column as include,
exclude, or defer. Label inferred definitions and terminology as external proposals and
ask before adding them to deployable YAML.
Target <SQL warehouse or Databricks Runtime version>. Save as <file>.
Do not create or update anything in Databricks.
~~~

## Create an offline draft

~~~text
Use the databricks-metric-view skill.
Create a metric view over <catalog.schema.table> for <business question>.
Treat this as the complete authoritative offline specification: <approved fields, measures,
comments, display names, formats, synonyms, grain, filters, units, and exclusions>.
If any business-critical meaning is missing, propose it outside YAML and ask before editing.
Target <SQL warehouse or Databricks Runtime version>.
Save it as <file>.
Check it, explain assumptions, and do not connect or deploy.
~~~

## Review semantics without editing

~~~text
Use the databricks-metric-view skill to review the attached YAML.
Target <SQL warehouse or Databricks Runtime version>.
Check question coverage, source grain, the column coverage ledger when source metadata is
available, measure contracts, comments, display names, formats, synonyms, joins, and overlap.
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
Do not treat deployment authorization as approval to invent missing semantics.
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
