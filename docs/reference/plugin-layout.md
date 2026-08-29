# Plugin package layout

Version 0.0.1 uses the Agent Plugins 1.0 layout.

```text
plugins/databricks-metric-view/
├── plugin.json
├── mcp.json
├── dist/
│   └── checker.mjs
├── skills/
│   └── databricks-metric-view/
│       ├── SKILL.md
│       ├── agents/openai.yaml
│       └── references/
├── LICENSE
└── THIRD_PARTY_NOTICES.md
```

`plugin.json` contains package metadata. `mcp.json` starts the local checker. `skills/` contains agent instructions. `dist/checker.mjs` is the self-contained runtime file.

The source repository also contains:

| Path | Purpose |
| --- | --- |
| `src/` | TypeScript checker source. |
| `tests/` | CLI, MCP, package, and skill tests. |
| `catalog/plugins.json` | Source for generated client marketplace files. |
| `.github/plugin/marketplace.json` | Generated VS Code and Copilot marketplace catalog. |
| `.agents/plugins/marketplace.json` | Generated Codex catalog. |
| `schemas/agent-plugins/1.0.0/` | Pinned standard schemas used during package checks. |

See the [Agent Plugins specification](https://agent-plugins.org/specification) for the portable format.
