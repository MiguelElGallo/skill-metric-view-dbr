# Databricks Metric View Plugin

Catch metric-view YAML mistakes on your computer, before you wait for Databricks to return them.

Version **0.0.1** includes:

- an agent skill for creating and changing Databricks metric views;
- a local MCP tool named `check_databricks_metric_view_yaml`;
- the same checker as a command-line tool;
- a bundled Node.js runtime file that works without `npm install` after the plugin is installed.

A local pass is a fast first check. Databricks still decides whether SQL expressions, tables, permissions, and data are valid.

## Start here

- [Learn by checking your first file](docs/tutorials/check-your-first-file.md)
- [Install the plugin in VS Code](docs/how-to/install-in-vscode.md)
- [Check an existing definition](docs/how-to/check-a-definition.md)
- [Browse all documentation](docs/index.md)

## Install from a local checkout

Add the plugin directory to VS Code `settings.json`:

```json
"chat.plugins.enabled": true,
"chat.pluginLocations": {
  "/absolute/path/to/skill-metric-view-dbr/plugins/databricks-metric-view": true
}
```

Then reload VS Code. The skill appears in **Chat: Configure Skills**, and the checker appears in **MCP: List Servers**.

## Develop

```bash
npm ci
npm run build
npm run generate
npm run check
```

`npm run check` checks TypeScript, the committed bundle, generated marketplace files, the plugin package, documentation links, and all tests.

## License

MIT. The bundled `yaml` library uses the ISC license; see [THIRD_PARTY_NOTICES.md](plugins/databricks-metric-view/THIRD_PARTY_NOTICES.md).
