# Deploy and verify a metric view

Use this guide when the definition is ready and you want the skill to create or update a real Databricks metric view.

## Before you start

You need:

- an authenticated Databricks CLI profile;
- a SQL warehouse ID and permission to use it;
- permission to read the sources and create or own the target view;
- the fully qualified target name.

For Azure Databricks setup, see [Authorize access to Azure Databricks resources](https://learn.microsoft.com/en-us/azure/databricks/dev-tools/auth/). Do not paste access tokens into Chat.

## Create a new view

~~~text
Use the databricks-metric-view skill to deploy the attached definition.

Databricks profile: <PROFILE>
SQL warehouse ID: <WAREHOUSE_ID>
Target: <catalog.schema.view_name>
Intent: create a new view

Check the complete definition before submission.
If the target already exists, stop without changing it.
After creation, read back the definition and query every important measure at a representative grain.
If trusted comparison SQL is attached, reconcile the same snapshot or as-of time, timezone,
parameters, filters, grouping keys, null and zero-denominator behavior.
Use agreed absolute and relative tolerances and matching rounding rules.
Report platform acceptance, smoke-query success, and business reconciliation separately.
~~~

The skill can proceed without asking again because the profile, warehouse, target, and create-only intent are explicit.

## Update an existing view

Use an update when the object should keep its identity and grants:

~~~text
Use the databricks-metric-view skill to update the attached definition.

Databricks profile: <PROFILE>
SQL warehouse ID: <WAREHOUSE_ID>
Target: <catalog.schema.view_name>
Intent: update that existing metric view with its complete YAML

Use ALTER VIEW so the target keeps its grants and object identity.
Check the definition first, update it, read it back, and run the important queries.
Do not change or drop any other object.
~~~

The skill should stop if the target is not an existing metric view owned by the current identity.

`CREATE OR REPLACE` is a reset, not the default update path. Databricks does not preserve the original grants or `table_id`. Use it only when you explicitly want that reset.

## Test parameterized views

If the definition has parameters, include representative values or complete defaults:

~~~text
Invoke this parameterized metric view as a table-valued function.
Use these named arguments: <name=value>.
Report the exact invocation and result.
~~~

## Check the report

A complete result distinguishes:

1. semantic evidence and unresolved business assumptions;
2. the fast checks performed before submission;
3. Databricks acceptance of the definition;
4. smoke-query results;
5. reconciliation with trusted SQL;
6. anything still not proven, such as untested filters or join cardinality.

A temporary analyzer canary proves parsing and source resolution only in that session. It does not prove permission or ownership on the final catalog and schema. A successful create or update of the fully qualified target is the target-specific acceptance proof.

If deployment fails, ask the skill to explain the Databricks error and make the smallest justified fix. Tell it not to resubmit until you give a new, explicit deployment request.
