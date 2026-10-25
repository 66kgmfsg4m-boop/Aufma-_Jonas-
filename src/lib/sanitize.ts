import { parseGermanNumber } from "@/lib/parse/text";
import type { DocType } from "@/lib/types";
import type { IncomingPart } from "@/lib/db";

export function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function asNumber(value: unknown, fallback = 0): number {
  const numeric = asPrice(value);
  return numeric == null ? fallback : numeric;
}

export function asDate(value: unknown): string {
  const text = asText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

export function asPrice(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parseGermanNumber(value)
        : null;
  if (numeric == null || !Number.isFinite(numeric) || Math.abs(numeric) > 10_000_000) return null;
  return numeric;
}

export function asDocType(value: unknown): DocType | null {
  return value === "rechnung" || value === "katalog" ? value : null;
}

export function sanitizeItems(value: unknown): IncomingPart[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 4000) return null;
  const items: IncomingPart[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const row = entry as Record<string, unknown>;
    const articleNumber = asText(row.articleNumber, 80);
    const name = asText(row.name, 300);
    const unit = asText(row.unit, 24);
    const unitPrice = asPrice(row.unitPrice);
    if ((!articleNumber && !name) || unitPrice == null) continue;
    const quantity = asPrice(row.quantity);
    const totalPrice = asPrice(row.totalPrice);
    const basis = asPrice(row.priceBasis);
    items.push({
      articleNumber,
      name,
      unit,
      unitPrice,
      quantity,
      totalPrice,
      priceBasis: basis != null && basis > 0 ? basis : 1,
    });
  }
  return items;
}
