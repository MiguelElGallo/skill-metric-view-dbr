# Create your first metric view

In this tutorial, we will write a small definition over the Databricks sample orders table, check it locally, and prepare its SQL statement.

The local steps are safe and need no Databricks connection. The final create command is shown but not run for you.

## Create the YAML file

Save this as `orders_metrics.yml`:

```yaml
version: 1.1
source: samples.tpch.orders
comment: Order counts and values grouped by status.

fields:
  - name: order_status
    expr: o_orderstatus
    comment: Status code stored on the order.

measures:
  - name: order_count
    expr: COUNT(*)
    comment: Number of orders.
  - name: total_order_value
    expr: SUM(o_totalprice)
    comment: Sum of the stored order total.
```

The repository includes the same definition in [examples/orders-metric-view.yml](../../examples/orders-metric-view.yml).

We use names that describe the source columns without inventing business meaning.

## Check it

Run:

```bash
node plugins/databricks-metric-view/dist/checker.mjs check \
  orders_metrics.yml \
  --compute sql-warehouse
```

The result should start with `PASS`. You have removed common YAML and structure mistakes before opening a warehouse.

## Prepare the Databricks statement

Choose a catalog, schema, and unused view name. Then place the YAML inside this statement:

```sql
CREATE VIEW my_catalog.my_schema.orders_metrics
WITH METRICS
LANGUAGE YAML
AS $$
version: 1.1
source: samples.tpch.orders
comment: Order counts and values grouped by status.
fields:
  - name: order_status
    expr: o_orderstatus
measures:
  - name: order_count
    expr: COUNT(*)
  - name: total_order_value
    expr: SUM(o_totalprice)
$$
```

The YAML indentation stays unchanged inside `$$`. Databricks can now perform the checks that need a real workspace.

For the live steps and a smoke query, continue with [Validate and create a view in Databricks](../how-to/validate-and-create-a-view.md).
