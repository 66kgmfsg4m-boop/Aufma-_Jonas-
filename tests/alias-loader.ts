import { existsSync } from "node:fs";
import { isBuiltin } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type NextResolve = (
  specifier: string,
  context: { parentURL?: string },
) => Promise<{ url: string; shortCircuit?: boolean }>;

const root = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

export async function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: NextResolve,
) {
  if (specifier.startsWith("@/") && !isBuiltin(specifier)) {
    const base = path.join(root, "src", specifier.slice(2));
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found) return nextResolve(pathToFileURL(found).href, context);
  }
  return nextResolve(specifier, context);
}
