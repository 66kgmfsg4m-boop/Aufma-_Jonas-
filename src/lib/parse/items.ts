import { findHeaderRow, inferMapping, remapByLabel } from "@/lib/parse/columns";
import {
  isSummaryLabel,
  isUnitToken,
  looksLikeArticle,
  normalizeUnit,
  parseGermanNumber,
  parsePriceCell,
  splitUnitCell,
  standardBasis,
} from "@/lib/parse/text";
import {
  emptyMapping,
  type ColumnMapping,
  type Confidence,
  type ExtractedItem,
} from "@/lib/types";

const MAX_ITEMS = 4000;

export function headerLabels(headers: string[]): string[] {
  return headers.map((header, index) => header.trim() || `Spalte ${index + 1}`);
}

function newId(): string {
  return crypto.randomUUID();
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function confidenceFor(item: {
  articleNumber: string;
  name: string;
  unit: string;
  unitPrice: number | null;
  derived: boolean;
}): Confidence {
  const identified = item.articleNumber.length >= 2 || item.name.length >= 3;
  if (!identified || item.unitPrice == null) return "niedrig";
  if (item.derived || !item.unit) return "mittel";
  return "hoch";
}

function inferBasisFromTotals(
  unitPrice: number,
  quantity: number,
  totalPrice: number,
): number | null {
  if (totalPrice === 0 || quantity === 0) return null;
  for (const basis of [1, 10, 100, 1000, 10000]) {
    const expected = (unitPrice * quantity) / basis;
    const delta = Math.abs(expected - totalPrice) / Math.abs(totalPrice);
    if (delta < 0.025) return basis;
  }
  return null;
}

export function itemFromMappedRow(
  row: string[],
  mapping: ColumnMapping,
  sheet = "",
): ExtractedItem | null {
  const articleNumber = clean(mapping.article == null ? "" : row[mapping.article]);
  const name = clean(mapping.name == null ? "" : row[mapping.name]);
  if (isSummaryLabel(name) || isSummaryLabel(articleNumber)) return null;

  const unitSplit = splitUnitCell(mapping.unit == null ? "" : (row[mapping.unit] ?? ""));
  const notes: string[] = [];
  const unit = unitSplit.unit;
  let unitPrice =
    mapping.unitPrice == null ? null : parsePriceCell(row[mapping.unitPrice] ?? "", true);
  const quantity =
    mapping.quantity == null ? null : parseGermanNumber(row[mapping.quantity] ?? "");
  const totalPrice =
    mapping.totalPrice == null ? null : parsePriceCell(row[mapping.totalPrice] ?? "", true);
  let basis = 1;
  if (mapping.priceBasis != null) {
    basis = standardBasis(parseGermanNumber(row[mapping.priceBasis] ?? ""));
  } else if (unitSplit.basis) {
    basis = standardBasis(unitSplit.basis);
  }

  let derived = false;
  if (
    unitPrice != null &&
    totalPrice != null &&
    quantity != null &&
    quantity !== 0 &&
    basis === 1
  ) {
    const inferred = inferBasisFromTotals(unitPrice, quantity, totalPrice);
    if (inferred && inferred > 1) basis = inferred;
  }
  if (basis > 1 && unitPrice != null) {
    unitPrice = unitPrice / basis;
    notes.push(`Preisbasis ${basis}: auf 1 ${unit || "Einheit"} umgerechnet`);
  }
  if (unitPrice == null && totalPrice != null && quantity != null && quantity !== 0) {
    unitPrice = totalPrice / quantity;
    derived = true;
    notes.push("Einzelpreis aus Menge und Gesamtpreis berechnet");
  }
  if (!articleNumber && !name && unitPrice == null && totalPrice == null) return null;
  if (!articleNumber && !name) return null;

  return {
    id: newId(),
    articleNumber,
    name,
    unit,
    unitPrice,
    quantity,
    totalPrice,
    priceBasis: basis,
    currency: "EUR",
    confidence: confidenceFor({ articleNumber, name, unit, unitPrice, derived }),
    note: notes.join(" "),
    sheet,
  };
}

function classifyCell(text: string, index: number, count: number): string {
  if (isUnitToken(text)) return "unit";
  if (parsePriceCell(text, false) != null) return "price";
  if (looksLikeArticle(text)) return "article";
  if (index === 0 && /^\d{1,4}$/.test(text) && Number(text) < 1000 && count > 3) return "position";
  if (parseGermanNumber(text) != null && !/[a-z]/i.test(text)) return "qty";
  return "text";
}

export function heuristicItem(cells: string[], sheet = ""): ExtractedItem | null {
  const expanded = cells.flatMap((cell) => {
    const match = cell.trim().match(/^(\d+(?:[.,]\d+)?)\s+([A-Za-zÄÖÜäöüß²]+)$/);
    if (match && isUnitToken(match[2] ?? "")) return [match[1] ?? "", match[2] ?? ""];
    return [cell.trim()];
  }).filter(Boolean);
  if (expanded.length === 0) return null;
  if (expanded.length <= 2) return parseFreeformLine(expanded.join(" "), sheet);

  const tagged = expanded.map((text, index) => ({
    text,
    index,
    kind: classifyCell(text, index, expanded.length),
  }));
  const prices = tagged.filter((cell) => cell.kind === "price");
  if (prices.length === 0) return parseFreeformLine(expanded.join(" "), sheet);

  const mapping = emptyMapping();
  const row = expanded.slice();
  if (prices.length === 1) mapping.unitPrice = prices[0]!.index;
  else {
    mapping.unitPrice = prices[prices.length - 2]!.index;
    mapping.totalPrice = prices[prices.length - 1]!.index;
  }
  const unit = tagged.find((cell) => cell.kind === "unit");
  if (unit) mapping.unit = unit.index;
  const article = tagged.find((cell) => cell.kind === "article");
  if (article) mapping.article = article.index;
  const quantity = unit
    ? tagged[tagged.indexOf(unit) - 1]
    : tagged.find((cell) => cell.kind === "qty");
  if (quantity && (quantity.kind === "qty" || quantity.kind === "position" || quantity.kind === "qty")) {
    if (quantity.kind !== "position") mapping.quantity = quantity.index;
  }
  if (!mapping.quantity) {
    const qty = tagged.find((cell) => cell.kind === "qty");
    if (qty) mapping.quantity = qty.index;
  }
  const nameParts = tagged.filter((cell) => cell.kind === "text").map((cell) => cell.text);
  if (nameParts.length > 0) {
    row.push(nameParts.join(" "));
    mapping.name = row.length - 1;
  }
  return itemFromMappedRow(row, mapping, sheet);
}

export function parseFreeformLine(line: string, sheet = ""): ExtractedItem | null {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (trimmed.length < 4 || isSummaryLabel(trimmed)) return null;
  const matches = [...trimmed.matchAll(/(?<![A-Za-z0-9])(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})(?!\d)/g)];
  if (matches.length === 0) return null;
  const unitPriceText = matches.length === 1 ? matches[0]![1]! : matches[matches.length - 2]![1]!;
  const totalText = matches.length > 1 ? matches[matches.length - 1]![1]! : "";
  let rest = trimmed;
  for (const match of matches) rest = rest.replace(match[1]!, " ");
  const unitMatch = rest.match(
    /(?:^|\s)(\d+(?:[.,]\d+)?)?\s*(Stk|Stck|Stück|Stueck|Meter|m²|m2|m³|m3|qm|kg|psch|lfm|VE|Sack|Paar|Rolle|m)(?:\s|$)/i,
  );
  const unit = unitMatch ? normalizeUnit(unitMatch[2] ?? "") : "";
  const quantity = unitMatch?.[1] ? parseGermanNumber(unitMatch[1]) : null;
  if (unitMatch) rest = rest.replace(unitMatch[0], " ");
  const articleMatch = rest.match(/\b([A-Za-z0-9][A-Za-z0-9./_-]{2,31})\b/g) ?? [];
  const article = articleMatch.find((token) => looksLikeArticle(token)) ?? "";
  if (article) rest = rest.replace(article, " ");
  rest = rest.replace(/^\d{1,4}\s+/, "");
  const name = rest.replace(/\s+/g, " ").replace(/^[,;:.-]+|[,;:.-]+$/g, "").trim();
  const mapping = emptyMapping();
  const row = ["", "", "", "", "", ""];
  row[0] = article;
  row[1] = name;
  row[2] = unit;
  row[3] = unitPriceText;
  row[4] = quantity == null ? "" : String(quantity);
  row[5] = totalText;
  mapping.article = 0;
  mapping.name = 1;
  mapping.unit = 2;
  mapping.unitPrice = 3;
  mapping.quantity = 4;
  mapping.totalPrice = totalText ? 5 : null;
  return itemFromMappedRow(row, mapping, sheet);
}

function isRepeatedHeader(row: string[], headers: string[]): boolean {
  const left = row.map((cell) => cell.trim().toLowerCase()).filter(Boolean).join("|");
  const right = headers.map((cell) => cell.trim().toLowerCase()).filter(Boolean).join("|");
  return left.length > 0 && left === right;
}

export function extractSheet(
  rows: string[][],
  sheet = "",
  override?: { mapping: ColumnMapping; headers: string[] },
): {
  items: ExtractedItem[];
  mapping: ColumnMapping;
  headers: string[];
  warnings: string[];
} {
  const detected = findHeaderRow(rows);
  let headerIndex = detected?.index ?? -1;
  let headers = detected ? headerLabels(rows[detected.index] ?? []) : [];
  let mapping = detected?.mapping ?? emptyMapping();
  const warnings: string[] = [];

  if (override) {
    if (headers.length === 0) {
      headers = override.headers;
      headerIndex = -1;
      mapping = override.mapping;
    } else {
      const same =
        override.headers.length === headers.length &&
        override.headers.every(
          (header, index) => header.trim().toLowerCase() === (headers[index] ?? "").trim().toLowerCase(),
        );
      mapping = same ? override.mapping : remapByLabel(headers, override.headers, override.mapping);
    }
  } else if (!detected) {
    const inferred = inferMapping(rows);
    if (inferred) {
      mapping = inferred;
      headers = rows[0]?.map((_, index) => `Spalte ${index + 1}`) ?? [];
      headerIndex = -1;
      warnings.push("Keine Überschrift erkannt. Spalten wurden aus den Werten geraten.");
    }
  }

  const structured = mapping.article != null || mapping.name != null || mapping.unitPrice != null || mapping.totalPrice != null;
  const items: ExtractedItem[] = [];
  const start = headerIndex >= 0 ? headerIndex + 1 : 0;
  for (let index = start; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    if (!row.some(Boolean)) continue;
    if (headerIndex >= 0 && isRepeatedHeader(row, rows[headerIndex] ?? [])) continue;
    const item = structured ? itemFromMappedRow(row, mapping, sheet) : heuristicItem(row, sheet);
    if (!item) continue;
    items.push(item);
    if (items.length >= MAX_ITEMS) {
      warnings.push("Es wurden nur die ersten 4000 Positionen gelesen.");
      break;
    }
  }

  if (items.some((item) => item.priceBasis > 1)) {
    warnings.push("Preisbasis 10, 100 oder 1000 erkannt. Einzelpreise sind auf eine Einheit umgerechnet.");
  }
  return { items, mapping, headers, warnings };
}
