# Improve an existing metric view

In this tutorial, you will give the skill an incomplete definition and ask it to make a precise repair. Nothing is sent to Databricks.

## Start with the definition

Create `orders-metric-view.yml`:

~~~yaml
version: 1.1
source: samples.tpch.orders

fields:
  - name: order_status
    expr: o_orderstatus

measures:
  - name: order_count
    expr: COUNT(*)
  - name: order_count
    expr: SUM(o_totalprice)
~~~

The second measure has the wrong name. Its intended name is `total_order_value`.

## Ask the skill to repair it

Open VS Code Chat in Agent mode. Drag the file into Chat or select **Add Context**, then paste:

~~~text
Use the databricks-metric-view skill to improve the attached definition.

Rename the second measure to total_order_value.
Preserve the source, ordering, and unrelated content.
Check the complete result.
Do not connect to Databricks and do not deploy.
~~~

## Review what changed

The skill should:

- change only the second measure name;
- check the full updated definition automatically;
- explain the repair in plain language;
- state which checks still need a live Databricks workspace.

Now try a review-only request:

~~~text
Review the updated file for unclear business descriptions.
Review the view purpose and every field and measure for comments, display names,
applicable formats, and genuine synonyms. Keep inferred terminology outside YAML,
show its evidence and target path, and ask before editing the file.
~~~

This separates objective definition problems from business wording that needs your judgment.
