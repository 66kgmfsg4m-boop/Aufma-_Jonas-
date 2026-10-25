export function fold(value: string): string {
  return value
    .toLowerCase()
    .replace(/m²/g, "m2")
    .replace(/m³/g, "m3")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

export function normalizeHeader(value: string): string {
  return fold(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseGermanNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let source = value.trim();
  if (!source || source === "-" || source === "–" || source === "—") return null;
  if (source.includes("%")) return null;
  source = source
    .replace(/€/g, "")
    .replace(/eur/gi, "")
    .replace(/\s/g, "")
    .replace(/'/g, "");
  if (!source) return null;
  const negative = source.startsWith("-");
  if (negative) source = source.slice(1);
  if (!/^\d+(?:[.,]\d+)*$/.test(source)) return null;

  const hasComma = source.includes(",");
  const hasDot = source.includes(".");
  if (hasComma && hasDot) {
    if (source.lastIndexOf(",") > source.lastIndexOf(".")) {
      source = source.replace(/\./g, "").replace(",", ".");
    } else {
      source = source.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = source.split(",");
    if (parts.length > 2) source = source.replace(/,/g, "");
    else source = source.replace(",", ".");
  } else if (hasDot) {
    const parts = source.split(".");
    if (parts.length > 2) {
      source = source.replace(/\./g, "");
    } else if (
      parts[1]?.length === 3 &&
      parts[0] &&
      parts[0] !== "0" &&
      parts[0].length <= 3
    ) {
      source = source.replace(".", "");
    }
  }

  const numeric = Number(negative ? `-${source}` : source);
  return Number.isFinite(numeric) ? numeric : null;
}

export function parsePriceCell(raw: string, allowInteger = false): number | null {
  const stripped = raw
    .trim()
    .replace(/€/g, "")
    .replace(/eur/gi, "")
    .trim();
  if (!stripped || stripped.includes("%")) return null;
  if (/[a-zäöü]/i.test(stripped)) return null;
  if (!allowInteger && !/[,.]/.test(stripped)) return null;
  const value = parseGermanNumber(stripped);
  if (value == null || Math.abs(value) > 10_000_000) return null;
  return value;
}

const UNIT_MAP: Record<string, string> = {
  stk: "Stk",
  stck: "Stk",
  st: "Stk",
  stueck: "Stk",
  piece: "Stk",
  pcs: "Stk",
  m: "m",
  mtr: "m",
  meter: "m",
  lfm: "m",
  lfdm: "m",
  m2: "m²",
  qm: "m²",
  m3: "m³",
  cbm: "m³",
  kg: "kg",
  psch: "psch",
  pauschal: "psch",
  pausch: "psch",
  rolle: "Rolle",
  rol: "Rolle",
  ve: "VE",
  vpe: "VE",
  sack: "Sack",
  set: "Set",
  paar: "Paar",
  std: "Std",
  stunde: "Std",
  l: "l",
  liter: "l",
  bund: "Bund",
  krt: "Krt",
  karton: "Krt",
  beutel: "Beutel",
  dose: "Dose",
  pack: "Pack",
  pkg: "Pack",
};

export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 24) return "";
  const key = fold(trimmed).replace(/[^a-z0-9]+/g, "");
  return UNIT_MAP[key] ?? "";
}

export function isUnitToken(raw: string): boolean {
  return normalizeUnit(raw) !== "";
}

export function splitUnitCell(raw: string): { unit: string; basis: number | null } {
  const trimmed = raw.trim();
  const combined = trimmed.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (combined) {
    const basis = parseGermanNumber(combined[1]);
    const unit = normalizeUnit(combined[2] ?? "");
    if (basis != null && basis > 1 && unit) return { unit, basis };
  }
  return { unit: normalizeUnit(trimmed), basis: null };
}

const SUMMARY =
  /^(summe|gesamtsumme|zwischensumme|uebertrag|nettobetrag|bruttobetrag|mehrwertsteuer|mwst|umsatzsteuer|ust|rabatt|skonto|endbetrag|rechnungsbetrag|zu zahlen|gesamtergebnis|total|subtotal)$/;

export function isSummaryLabel(name: string): boolean {
  const normalized = fold(name)
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return false;
  if (SUMMARY.test(normalized)) return true;
  return /^(summe|zwischensumme|gesamt|uebertrag|netto|brutto)\b/.test(normalized) &&
    normalized.length < 42;
}

export function looksLikeArticle(text: string): boolean {
  const value = text.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9./_-]*$/.test(value)) return false;
  if (!/\d/.test(value)) return false;
  if (/^\d{1,4}$/.test(value)) return false;
  if (value.length >= 5 && /^\d+$/.test(value)) return true;
  return /[A-Za-z]/.test(value) && value.length >= 3 && value.length <= 32;
}

export function suggestSupplier(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(/[_+.-]+/g, " ")
    .replace(
      /\b(20\d{2}|katalog|preisliste|preise|preis|rechnung|invoice|angebot|export|liste|xlsx|csv|pdf)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120);
}

export function decodeCsvBuffer(buffer: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8.replace(/^\uFEFF/, "");
  return new TextDecoder("windows-1252").decode(buffer);
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 12).join("\n");
  const semis = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  const tabs = (sample.match(/\t/g) ?? []).length;
  if (semis > 0 && semis >= commas / 3 && semis >= tabs) return ";";
  if (tabs > commas) return "\t";
  return ",";
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

const STANDARD_BASIS = new Set([10, 100, 1000, 10000]);

export function standardBasis(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return 1;
  const rounded = Math.round(value);
  return STANDARD_BASIS.has(rounded) ? rounded : 1;
}
