# Command-line reference

The installed command is the bundled file `dist/checker.mjs` inside the plugin directory.

## Syntax

```text
node checker.mjs check <file|-> [options]
```

`-` reads YAML from standard input.

## Options

| Option | Value | Default | Description |
| --- | --- | --- | --- |
| `--format` | `text` or `json` | `text` | Selects the output format. |
| `--compute` | `sql-warehouse` or `dbr` | none | Adds compute compatibility context. |
| `--runtime` | `major.minor` | none | Sets the Databricks Runtime version and implies `--compute dbr`. |
| `--allow-unknown` | none | off | Changes checker-unknown fields from errors to warnings. |
| `-h`, `--help` | none | — | Prints help. |

`--runtime` and `--compute sql-warehouse` cannot be used together.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Local checks passed. |
| `1` | One or more validation errors were found. |
| `2` | The command, file, or input could not be used. |

## JSON result

The JSON result contains the checker version, rules date, proof level, source, compute context, validity, counts, diagnostics, and disclaimer. Each diagnostic includes a code, severity, YAML path, line, column, message, and local proof level.
