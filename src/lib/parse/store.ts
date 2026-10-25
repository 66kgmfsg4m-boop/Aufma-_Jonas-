import fs from "node:fs";
import path from "node:path";
import type { ColumnMapping, SheetGrid } from "@/lib/types";

export type StoredParse = {
  id: string;
  filename: string;
  kind: "spreadsheet" | "pdf";
  createdAt: number;
  primaryHeaders: string[];
  sheets: SheetGrid[];
  warnings: string[];
};

const tmpDir = path.join(process.cwd(), "data", "tmp");

function fileFor(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Ungültige Parse-ID");
  const resolved = path.resolve(tmpDir, `${id}.json`);
  if (!resolved.startsWith(path.resolve(tmpDir) + path.sep)) {
    throw new Error("Ungültige Parse-ID");
  }
  return resolved;
}

export function saveParse(stored: StoredParse): void {
  fs.mkdirSync(tmpDir, { recursive: true });
  const cutoff = Date.now() - 12 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(tmpDir)) {
    const full = path.join(tmpDir, entry);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) fs.rmSync(full, { force: true });
  }
  fs.writeFileSync(fileFor(stored.id), JSON.stringify(stored));
}

export function loadParse(id: string): StoredParse {
  const raw = fs.readFileSync(fileFor(id), "utf8");
  return JSON.parse(raw) as StoredParse;
}

export function isMapping(value: unknown): value is ColumnMapping {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [
    "article",
    "name",
    "unit",
    "unitPrice",
    "quantity",
    "totalPrice",
    "priceBasis",
  ].every((field) => record[field] == null || typeof record[field] === "number");
}
