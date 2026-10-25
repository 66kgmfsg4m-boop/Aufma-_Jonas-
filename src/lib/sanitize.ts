import { parseGermanNumber } from "@/lib/parse/text";
import type { DocType } from "@/lib/types";
import type { IncomingPart } from "@/lib/db";

export function asText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
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
