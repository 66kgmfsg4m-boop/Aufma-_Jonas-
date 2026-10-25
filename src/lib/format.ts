const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const berlin = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatEuro(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits = abs > 0 && abs < 0.1 ? 3 : 2;
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 4,
  }).format(value);
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return berlin.format(date);
}

export function formatUnit(unit: string): string {
  if (!unit) return "Einheit offen";
  if (unit === "Stk") return "je Stück";
  if (unit === "m") return "je Meter";
  if (unit === "m²") return "je m²";
  if (unit === "m³") return "je m³";
  if (unit === "psch") return "pauschal";
  return `je ${unit}`;
}

export function docTypeLabel(docType: string): string {
  return docType === "rechnung" ? "Rechnung" : "Preiskatalog";
}

export { euro };
