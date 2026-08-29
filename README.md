# Databricks Metric View Plugin

Create, improve, review, and deploy Databricks metric views from VS Code Chat.

## Install in VS Code

> [!TIP]
> **Command Palette → `Chat: Install Plugin From Source` → paste the repository URL → select `databricks-metric-view`. Voilà!**

Use this repository URL:

~~~text
https://github.com/MiguelElGallo/skill-metric-view-dbr
~~~

The skill and its automatic preflight are now available in VS Code Chat. The plugin uses VS Code's bundled runtime, so no separate checker setup is required.

## Use the skill

Open or create the project folder where you want the definition saved. Then open Chat in Agent mode and paste:

~~~text
Use the databricks-metric-view skill.

Create a Databricks metric view over samples.tpch.orders.
- Use o_orderstatus as order_status.
- Add order_count as COUNT(*).
- Add total_order_value as SUM(o_totalprice).
- Target a SQL warehouse.
- Save it as orders-metric-view.yml.

Check the result, explain what you created, and do not deploy it.
~~~

That is the complete workflow for a draft. The skill writes the definition, checks it automatically, and tells you what would still need a real Databricks workspace. You do not need a separate validation command.

## What can you ask?

| Goal | Example |
| --- | --- |
| Create a metric view | “Create a metric view from this table and these business measures. Do not deploy.” |
| Improve an existing definition | “Review the attached metric-view YAML, fix its errors, and preserve unrelated content.” |
| Discover semantics from real data | “With profile `PROFILE`, analyze `catalog.schema.table` for this business question. Use the bounded sampling budget in the discovery guide. Show the evidence-backed fields and measures before writing YAML. Do not deploy.” |
| Deploy and verify | “With profile `PROFILE` and warehouse `WAREHOUSE_ID`, create `catalog.schema.view`. Create only; stop if it exists. Read it back and test the important measures.” |

The skill does not create or update a Databricks object unless you ask it to. For live work, provide the Databricks profile, warehouse, target name, and create-or-update intent.

## Learn more

- [Detailed VS Code installation and troubleshooting](docs/how-to/install-in-vscode.md)
- [Create your first metric view](docs/tutorials/create-your-first-metric-view.md)
- [Discover useful semantics from a real table](docs/how-to/create-from-a-table.md)
- [Improve an existing metric view](docs/tutorials/improve-an-existing-metric-view.md)
- [Copy a prompt for your task](docs/reference/prompt-library.md)
- [Browse all documentation](docs/index.md)

## Contribute

~~~bash
npm ci
npm run build
npm run generate
npm run check
~~~

`npm run check` checks the source, bundled plugin, package metadata, documentation, and tests.

## License

MIT. See [THIRD_PARTY_NOTICES.md](plugins/databricks-metric-view/THIRD_PARTY_NOTICES.md) for bundled dependencies.
