import { formatCliError, runCli } from "./cli.js";
import { runMcpServer } from "./mcp.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args[0] === "mcp") {
    await runMcpServer();
    return;
  }
  const code = await runCli(args);
  process.exitCode = code;
}

main().catch((error: unknown) => {
  process.stderr.write(`metric-view-checker: ${formatCliError(error)}\n`);
  process.exitCode = 2;
});
