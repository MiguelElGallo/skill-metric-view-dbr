# Create your first metric view

In this tutorial, you will ask the skill to create a useful metric view, refine it, and explain what is ready. You will not connect to Databricks or deploy anything.

## Before you start

Install the plugin with [Install the skill in VS Code](../how-to/install-in-vscode.md), then open or create the writable project folder where you want the YAML saved.

## Ask for the first draft

Open VS Code Chat in Agent mode and paste:

~~~text
Use the databricks-metric-view skill.

Create a Databricks metric view over samples.tpch.orders.
- Use o_orderstatus as a field named order_status.
- Add order_count as COUNT(*).
- Add total_order_value as SUM(o_totalprice).
- Use YAML version 1.1 for a SQL warehouse.
- Save the result as orders-metric-view.yml.

Check the complete definition. Do not connect to Databricks and do not deploy.
~~~

The source columns and calculations are explicit, so the skill does not have to guess their meaning.

## Review the result

The skill should:

- create `orders-metric-view.yml`;
- explain the fields and measures it added;
- run its fast checks automatically;
- distinguish a locally checked draft from a definition accepted by Databricks.

You do not need to run another command.

## Refine the view

Continue in the same chat:

~~~text
Add average_order_value as AVG(o_totalprice).
Give it a clear display name and comment.
Keep everything else unchanged and check the complete definition again.
~~~

The skill should make the focused change, preserve the rest of the file, and report the new result.

## Choose the next step

You now have a checked draft. You can:

- ask the skill to [review it in more detail](../how-to/review-an-existing-view.md);
- ask it to [deploy and verify the view](../how-to/deploy-a-view.md); or
- keep editing locally without a Databricks connection.
