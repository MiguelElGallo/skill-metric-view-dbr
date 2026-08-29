# Install the plugin in VS Code

Use this guide when you have a local checkout and want VS Code to load its skill and checker.

## Register the plugin

Open your user `settings.json` and add the absolute plugin path:

```json
"chat.plugins.enabled": true,
"chat.pluginLocations": {
  "/absolute/path/to/skill-metric-view-dbr/plugins/databricks-metric-view": true
}
```

Keep any plugin locations already present in the object.

Reload the VS Code window.

## Confirm the skill

Run **Chat: Configure Skills** from the Command Palette. Confirm that `databricks-metric-view` is enabled.

## Confirm the tool

Run **MCP: List Servers**. Confirm that `databricks-metric-view-checker` is running.

Open Chat and enter:

```text
Use the Databricks metric view skill to check this YAML locally. Do not deploy it:

version: 1.1
source: samples.tpch.orders
measures:
  - name: order_count
    expr: COUNT(*)
```

A working installation calls `check_databricks_metric_view_yaml` and returns a local pass with the proof disclaimer.

If the plugin is missing, confirm the path points to the directory that contains `plugin.json`. If the tool does not start, confirm that `node --version` works in the environment that launches VS Code.

See the current [VS Code agent plugin documentation](https://code.visualstudio.com/docs/agent-customization/agent-plugins) for marketplace installation and management.
