# Why the checker uses Node.js

The checker is written in TypeScript and distributed as one bundled JavaScript file.

VS Code works naturally with local command-based tools, and Node.js is available on macOS, Linux, and Windows without building a platform-specific binary. Bundling the YAML library removes the need to run `npm install` inside an installed plugin.

Python would make the source compact, but a portable copy would still need a Python interpreter and a separately available YAML package unless that dependency were vendored. Rust could produce a fast standalone program, but the release would need a binary for every supported operating system and processor.

Node.js offers the simplest installation trade-off for this plugin: one readable source language, one shared engine for the CLI and MCP tool, and one cross-platform bundle. The cost is a Node.js 20-or-newer requirement.
