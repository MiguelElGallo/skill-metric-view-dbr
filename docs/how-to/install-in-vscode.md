# Install the skill in VS Code

## Install from the repository

1. Open the Command Palette with `⇧⌘P` on macOS or `Ctrl+Shift+P` on Windows and Linux.
2. Run **Chat: Install Plugin From Source**.
3. Paste:

   ~~~text
   https://github.com/MiguelElGallo/skill-metric-view-dbr
   ~~~

4. Select **databricks-metric-view**.

Voilà—the skill and its automatic preflight are ready in Chat. The plugin uses VS Code's bundled runtime, so there is no separate checker installation step.

## Try it

Open or create a writable project folder. Then open Chat in Agent mode and enter:

~~~text
Use the databricks-metric-view skill.
Create a small metric view over samples.tpch.orders with an order_count measure.
Check it, but do not deploy it.
~~~

The response should include a metric-view definition, the result of its automatic checks, and a clear note about anything that would still require Databricks.

## If the skill does not appear

Run **Chat: Configure Skills** from the Command Palette and enable **databricks-metric-view**.

If the skill appears but says its automatic preflight is unavailable, run **MCP: List Servers** and open the log for **databricks-metric-view-checker**. Reload the VS Code window once after updating the plugin. Outside VS Code, the launcher can fall back to Node.js 20 or newer.

See the current [VS Code agent plugin documentation](https://code.visualstudio.com/docs/agent-customization/agent-plugins) for VS Code installation and management details.
