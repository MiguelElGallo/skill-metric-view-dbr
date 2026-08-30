# Create your first metric view

In this tutorial, you will ask the skill to create a useful metric view, refine it, and explain what is ready. You will not connect to Databricks or deploy anything.

## Before you start

Install the plugin with [Install the skill in VS Code](../how-to/install-in-vscode.md), then open or create the writable project folder where you want the YAML saved.

## Ask for the first draft

Open VS Code Chat in Agent mode and paste:

~~~text
Use the databricks-metric-view skill.

Create a Databricks metric view over samples.tpch.orders.
- This is an offline tutorial. Treat the following list as the complete approved scope.
- Business purpose: analyze order volume and value by order date and documented status.
- Grain: one row per order, identified by o_orderkey.
- order_date uses o_orderdate; comment "Date when the order was placed";
  display name "Order Date"; synonyms "order time" and "date of order".
- order_status maps O to Open, P to Processing, and F to Fulfilled, following
  the Databricks TPC-H tutorial; comment "Fulfillment status of the order";
  display name "Order Status"; synonyms "status" and "fulfillment status".
- order_count is COUNT(DISTINCT o_orderkey); comment "Number of distinct orders";
  display name "Order Count"; number format with zero decimal places;
  synonyms "number of orders" and "order volume".
- total_revenue is SUM(o_totalprice); for this tutorial, approve the Databricks
  example's USD presentation; comment "Total value of orders";
  display name "Total Revenue"; synonyms "revenue" and "total sales".
- Use YAML version 1.1 for a SQL warehouse.
- Save the result as orders-metric-view.yml.

Check the complete definition. Do not connect to Databricks and do not deploy.
~~~

The source columns, calculations, descriptions, vocabulary, and tutorial assumptions are explicit, so the skill does not have to invent their meaning. In a real project, it would read existing comments and propose missing terminology for approval.

## Review the result

The skill should:

- create `orders-metric-view.yml`;
- explain the fields and measures it added;
- show that every explicit field and measure has approved semantic metadata;
- run its fast checks automatically;
- distinguish a locally checked draft from a definition accepted by Databricks.

You do not need to run another command.

## Refine the view

Continue in the same chat:

~~~text
Add average_order_value as AVG(o_totalprice).
Before editing YAML, propose its formula contract, comment, display name, USD format,
and genuine synonyms for approval. Do not assume deploy authorization is semantic approval.
Keep everything else unchanged and check the complete definition again.
~~~

After you approve the proposal, the skill should make the focused change, preserve the rest of the file, and report the new result.

## Choose the next step

You now have a checked draft. You can:

- ask the skill to [review it in more detail](../how-to/review-an-existing-view.md);
- ask it to [deploy and verify the view](../how-to/deploy-a-view.md); or
- keep editing locally without a Databricks connection.
