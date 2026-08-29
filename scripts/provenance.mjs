import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function normalizedTextSha256(value) {
  return createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");
}

export async function normalizedTextFileSha256(path) {
  return normalizedTextSha256(await readFile(path, "utf8"));
}
