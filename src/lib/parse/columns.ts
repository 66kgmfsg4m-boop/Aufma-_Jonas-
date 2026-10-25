import {
  emptyMapping,
  type ColumnMapping,
  type Field,
} from "@/lib/types";
import { normalizeHeader, parseGermanNumber, parsePriceCell, isUnitToken, looksLikeArticle } from "@/lib/parse/text";

type Spec = { field: Field; token: string; weight: number };

const SPECS: Spec[] = [
  { field: "article", token: "artikelnummer", weight: 100 },
  { field: "article", token: "artikelnr", weight: 96 },
  { field: "article", token: "artikel nr", weight: 94 },
  { field: "article", token: "art nr", weight: 94 },
  { field: "article", token: "artnr", weight: 92 },
  { field: "article", token: "bestellnummer", weight: 90 },
  { field: "article", token: "bestell nr", weight: 88 },
  { field: "article", token: "warennummer", weight: 88 },
  { field: "article", token: "materialnummer", weight: 88 },
  { field: "article", token: "material nr", weight: 84 },
  { field: "article", token: "hersteller nr", weight: 78 },
  { field: "article", token: "ean", weight: 36 },
  { field: "article", token: "artikel", weight: 24 },
  { field: "name", token: "artikelbezeichnung", weight: 100 },
  { field: "name", token: "warenbezeichnung", weight: 98 },
  { field: "name", token: "bezeichnung", weight: 92 },
  { field: "name", token: "beschreibung", weight: 86 },
  { field: "name", token: "kurztext", weight: 84 },
  { field: "name", token: "langtext", weight: 84 },
  { field: "name", token: "positionstext", weight: 80 },
  { field: "name", token: "artikeltext", weight: 80 },
  { field: "name", token: "text", weight: 18 },
  { field: "unit", token: "mengeneinheit", weight: 100 },
  { field: "unit", token: "einheit", weight: 90 },
  { field: "unit", token: "me", weight: 72 },
  { field: "unit", token: "eh", weight: 36 },
  { field: "unitPrice", token: "nettopreis", weight: 100 },
  { field: "unitPrice", token: "einzelpreis", weight: 98 },
  { field: "unitPrice", token: "stueckpreis", weight: 96 },
  { field: "unitPrice", token: "meterpreis", weight: 96 },
  { field: "unitPrice", token: "preis pro einheit", weight: 94 },
  { field: "unitPrice", token: "einkaufspreis", weight: 90 },
  { field: "unitPrice", token: "ek preis", weight: 88 },
  { field: "unitPrice", token: "listenpreis", weight: 70 },
  { field: "unitPrice", token: "verkaufspreis", weight: 60 },
  { field: "unitPrice", token: "vk preis", weight: 58 },
  { field: "unitPrice", token: "ep", weight: 56 },
  { field: "unitPrice", token: "preis", weight: 42 },
  { field: "unitPrice", token: "ek", weight: 38 },
  { field: "unitPrice", token: "vk", weight: 30 },
  { field: "quantity", token: "menge", weight: 90 },
  { field: "quantity", token: "anzahl", weight: 80 },
  { field: "quantity", token: "qty", weight: 70 },
  { field: "totalPrice", token: "gesamtpreis", weight: 100 },
  { field: "totalPrice", token: "positionsbetrag", weight: 92 },
  { field: "totalPrice", token: "nettosumme", weight: 70 },
  { field: "totalPrice", token: "betrag", weight: 58 },
  { field: "totalPrice", token: "gesamt", weight: 50 },
  { field: "totalPrice", token: "gp", weight: 48 },
  { field: "totalPrice", token: "summe", weight: 36 },
  { field: "priceBasis", token: "preiseinheit", weight: 100 },
  { field: "priceBasis", token: "preisbasis", weight: 92 },
  { field: "priceBasis", token: "preismenge", weight: 88 },
  { field: "priceBasis", token: "pe", weight: 74 },
];

function headerMatches(header: string, token: string): boolean {
  if (header === token) return true;
  const index = header.indexOf(token);
  if (index < 0) return false;
  const before = index === 0 || header[index - 1] === " ";
  const after =
    index + token.length === header.length || header[index + token.length] === " ";
  if (before && after) return true;
  // "Warenbezeichnung" carries "bezeichnung" as the tail of the same word.
  const previous = header[index - 1];
  return token.length >= 8 && after && index > 0 && !!previous && /[a-z]/.test(previous);
}

function ignored(header: string): boolean {
  return ["mwst", "mehrwertsteuer", "umsatzsteuer", "steuer", "rabatt", "skonto", "waehrung"].some(
    (token) => headerMatches(header, token) || (token.length >= 5 && header.includes(token)),
  );
}

export function mappingFromHeaders(headers: string[]): { mapping: ColumnMapping; score: number } {
  const mapping = emptyMapping();
  const best: Partial<Record<Field, { index: number; weight: number; length: number }>> = {};
  headers.forEach((raw, index) => {
    const header = normalizeHeader(String(raw ?? ""));
    if (!header || ignored(header)) return;
    for (const spec of SPECS) {
      if (!headerMatches(header, spec.token)) continue;
      const previous = best[spec.field];
      if (
        !previous ||
        spec.weight > previous.weight ||
        (spec.weight === previous.weight && spec.token.length > previous.length)
      ) {
        best[spec.field] = { index, weight: spec.weight, length: spec.token.length };
      }
    }
  });

  let score = 0;
  for (const field of Object.keys(best) as Field[]) {
    const winner = best[field];
    if (!winner) continue;
    mapping[field] = winner.index;
    score += winner.weight;
  }
  const hasPrice = mapping.unitPrice != null || mapping.totalPrice != null || mapping.priceBasis != null;
  const hasIdentity = mapping.name != null || mapping.article != null || mapping.unit != null;
  if (!hasPrice || !hasIdentity || score < 100) {
    return { mapping: emptyMapping(), score: 0 };
  }
  return { mapping, score };
}

export function findHeaderRow(rows: string[][]): { index: number; mapping: ColumnMapping; score: number } | null {
  let best: { index: number; mapping: ColumnMapping; score: number } | null = null;
  const limit = Math.min(rows.length, 30);
  for (let index = 0; index < limit; index += 1) {
    const found = mappingFromHeaders(rows[index] ?? []);
    if (!best || found.score > best.score) {
      best = { index, mapping: found.mapping, score: found.score };
    }
  }
  if (!best || best.score <= 0) return null;
  return best;
}

export function inferMapping(rows: string[][]): ColumnMapping | null {
  const sample = rows.slice(0, 200).filter((row) => row.some(Boolean));
  if (sample.length < 2) return null;
  const width = Math.max(...sample.map((row) => row.length), 0);
  const used = new Set<number>();
  const mapping = emptyMapping();

  const stats = Array.from({ length: width }, (_, index) => {
    let nonempty = 0;
    let prices = 0;
    let units = 0;
    let articles = 0;
    let texts = 0;
    let basisHits = 0;
    let numbers = 0;
    for (const row of sample) {
      const cell = (row[index] ?? "").trim();
      if (!cell) continue;
      nonempty += 1;
      if (parsePriceCell(cell, false) != null) prices += 1;
      if (isUnitToken(cell)) units += 1;
      if (looksLikeArticle(cell)) articles += 1;
      if (/[a-zäöü]/i.test(cell) && cell.length > 12) texts += 1;
      const numeric = parseGermanNumber(cell);
      if (numeric != null && !/[a-z]/i.test(cell)) {
        numbers += 1;
        if ([10, 100, 1000, 10000].includes(Math.round(numeric))) basisHits += 1;
      }
    }
    return { index, nonempty, prices, units, articles, texts, basisHits, numbers };
  }).filter((column) => column.nonempty > 0);

  const ratio = (count: number, nonempty: number) => (nonempty === 0 ? 0 : count / nonempty);
  const take = (candidates: typeof stats, predicate: (column: (typeof stats)[number]) => number) => {
    const ranked = candidates
      .filter((column) => !used.has(column.index))
      .map((column) => ({ column, value: predicate(column) }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value || a.column.index - b.column.index);
    return ranked[0]?.column ?? null;
  };

  const basis = take(stats, (column) =>
    ratio(column.basisHits, column.nonempty) >= 0.6 ? ratio(column.basisHits, column.nonempty) : 0,
  );
  if (basis) {
    mapping.priceBasis = basis.index;
    used.add(basis.index);
  }

  const priceColumns = stats
    .filter((column) => !used.has(column.index) && ratio(column.prices, column.nonempty) >= 0.45)
    .sort((a, b) => a.index - b.index);
  if (priceColumns.length === 1) {
    mapping.unitPrice = priceColumns[0]!.index;
    used.add(priceColumns[0]!.index);
  } else if (priceColumns.length >= 2) {
    mapping.unitPrice = priceColumns[priceColumns.length - 2]!.index;
    mapping.totalPrice = priceColumns[priceColumns.length - 1]!.index;
    used.add(priceColumns[priceColumns.length - 2]!.index);
    used.add(priceColumns[priceColumns.length - 1]!.index);
  }

  const unit = take(stats, (column) => (ratio(column.units, column.nonempty) >= 0.5 ? ratio(column.units, column.nonempty) : 0));
  if (unit) {
    mapping.unit = unit.index;
    used.add(unit.index);
  }
  const article = take(stats, (column) =>
    ratio(column.articles, column.nonempty) >= 0.4 ? ratio(column.articles, column.nonempty) : 0,
  );
  if (article) {
    mapping.article = article.index;
    used.add(article.index);
  }
  const name = take(stats, (column) => (ratio(column.texts, column.nonempty) >= 0.4 ? ratio(column.texts, column.nonempty) : 0));
  if (name) {
    mapping.name = name.index;
    used.add(name.index);
  }
  const quantity = take(stats, (column) => {
    const numericRatio = ratio(column.numbers, column.nonempty);
    const priceRatio = ratio(column.prices, column.nonempty);
    return numericRatio >= 0.5 && priceRatio < 0.3 ? numericRatio : 0;
  });
  if (quantity) mapping.quantity = quantity.index;

  if (mapping.unitPrice == null && mapping.totalPrice == null) return null;
  return mapping;
}

export function remapByLabel(
  sheetHeaders: string[],
  primaryHeaders: string[],
  mapping: ColumnMapping,
): ColumnMapping {
  const next = emptyMapping();
  for (const field of Object.keys(mapping) as Field[]) {
    const index = mapping[field];
    if (index == null) continue;
    const label = primaryHeaders[index] ?? "";
    if (!label.trim()) {
      next[field] = index < sheetHeaders.length ? index : null;
      continue;
    }
    const found = sheetHeaders.findIndex(
      (header) => normalizeHeader(header) === normalizeHeader(label),
    );
    next[field] = found >= 0 ? found : null;
  }
  return next;
}
