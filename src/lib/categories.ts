import { openDatabase } from "@/lib/db";
import type { StoredCategory } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

const PALETTE = [
  "#e2b15a",
  "#5ec8d8",
  "#f0a05a",
  "#b48cff",
  "#7dce82",
  "#f07167",
  "#7eb6ff",
  "#5dcec0",
  "#c6d96a",
  "#e6c85c",
  "#e58ab5",
  "#d2a48a",
  "#b7b1a6",
  "#9aa7ff",
  "#ff9b71",
];

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function num(value: SqlValue | undefined): number {
  return typeof value === "number" ? value : 0;
}

function mapCategory(row: Record<string, SqlValue>): StoredCategory {
  return {
    id: text(row.id),
    label: text(row.label),
    hint: text(row.hint),
    color: text(row.color) || "#b7b1a6",
    position: num(row.position),
  };
}

export function listCategories(): StoredCategory[] {
  return openDatabase()
    .prepare("SELECT * FROM categories ORDER BY position ASC, label COLLATE NOCASE")
    .all()
    .map(mapCategory);
}

export function getCategory(id: string): StoredCategory | null {
  const row = openDatabase().prepare("SELECT * FROM categories WHERE id = ?").get(id);
  return row ? mapCategory(row) : null;
}

export function createCategory(input: { label: string; color?: string }): StoredCategory | null {
  const label = input.label.trim().slice(0, 40);
  if (!label) return null;
  const db = openDatabase();
  const countRow = db.prepare("SELECT COUNT(*) AS c FROM categories").get();
  const count = num(countRow?.c);
  const positionRow = db.prepare("SELECT COALESCE(MAX(position), -1) AS p FROM categories").get();
  const id = `c-${crypto.randomUUID()}`;
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? "")
    ? (input.color as string)
    : PALETTE[count % PALETTE.length]!;
  db.prepare(
    "INSERT INTO categories (id, label, color, hint, position) VALUES (?, ?, ?, '', ?)",
  ).run(id, label, color, num(positionRow?.p) + 1);
  return getCategory(id);
}

export function updateCategory(
  id: string,
  input: { label?: string; color?: string; hint?: string },
): StoredCategory | null {
  const current = getCategory(id);
  if (!current) return null;
  const label = (input.label ?? current.label).trim().slice(0, 40);
  if (!label) return null;
  const color = /^#[0-9a-fA-F]{6}$/.test(input.color ?? "") ? input.color! : current.color;
  const hint = (input.hint ?? current.hint).trim().slice(0, 80);
  openDatabase()
    .prepare("UPDATE categories SET label = ?, color = ?, hint = ? WHERE id = ?")
    .run(label, color, hint, id);
  return getCategory(id);
}

export function deleteCategory(id: string): boolean {
  const db = openDatabase();
  const count = num(db.prepare("SELECT COUNT(*) AS c FROM categories").get()?.c);
  if (count <= 1) return false;
  const current = getCategory(id);
  if (!current) return false;
  db.prepare("UPDATE parts SET category_id = NULL WHERE category_id = ?").run(id);
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  return true;
}
