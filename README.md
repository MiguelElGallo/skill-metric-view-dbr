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

With profile <PROFILE>, design a production-ready Databricks metric view over
<catalog.schema.table> for these business questions: <questions>.

Metadata only: do not read table rows.
1. Read the complete table and column metadata, including existing comments.
2. Classify every source column as include, exclude, or defer, with a reason.
3. Show the source grain, keys, question coverage, measure contracts, and join evidence.
4. Reuse current approved terminology. If descriptions, display names, formats,
   or synonyms are missing, draft sourced suggestions outside the YAML and ask me
   before adding new business meaning.
5. After approval, save <file.yml>, check it, and do not deploy it.
~~~

That is the complete workflow. The skill studies the source semantics, asks once about meaningful gaps, writes the approved definition, checks it automatically, and tells you what remains unproven. You do not need a separate validation command.

## What can you ask?

| Goal | Example |
| --- | --- |
| Create a metric view | “Create a metric view from this table. Review every column, enrich every included field and measure, ask before inventing terminology, and do not deploy.” |
| Improve an existing definition | “Review the attached metric-view YAML for semantic coverage and correctness. Preserve unrelated content and keep unapproved suggestions outside YAML.” |
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
