# Install the skill in VS Code

## Install from the repository

1. Open the Command Palette with `⇧⌘P` on macOS or `Ctrl+Shift+P` on Windows and Linux.
2. Run **Chat: Install Plugin From Source**.
3. Paste:

   ~~~text
   https://github.com/MiguelElGallo/skill-metric-view-dbr
   ~~~

4. Select **databricks-metric-view**.

Voilà—the skill is ready in Chat.

The skill's automatic preflight requires Node.js 20 or newer on the path used by VS Code.

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

If the skill appears but says its automatic preflight is unavailable, run `node --version` in the VS Code terminal. Install or select Node.js 20 or newer, then reload the VS Code window.

See the current [VS Code agent plugin documentation](https://code.visualstudio.com/docs/agent-customization/agent-plugins) for VS Code installation and management details.
