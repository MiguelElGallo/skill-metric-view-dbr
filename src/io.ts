import { readFile } from "node:fs/promises";

const MAX_INPUT_BYTES = 2 * 1024 * 1024;

export async function readYamlFile(path: string): Promise<string> {
  const data = await readFile(path);
  if (data.byteLength > MAX_INPUT_BYTES) {
    throw new Error(`YAML input exceeds the ${MAX_INPUT_BYTES}-byte safety limit`);
  }
  return data.toString("utf8");
}

export async function readStandardInput(): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_INPUT_BYTES) {
      throw new Error(`YAML input exceeds the ${MAX_INPUT_BYTES}-byte safety limit`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
