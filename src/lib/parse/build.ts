import { extractSheet } from "@/lib/parse/items";
import { suggestSupplier } from "@/lib/parse/text";
import {
  emptyMapping,
  type ColumnMapping,
  type ParseResult,
  type SheetGrid,
} from "@/lib/types";

export function buildParsed(input: {
  filename: string;
  kind: "spreadsheet" | "pdf";
  sheets: SheetGrid[];
  warnings?: string[];
  primaryHeaders?: string[];
  override?: ColumnMapping;
}): Omit<ParseResult, "parseId"> {
  const warnings = [...(input.warnings ?? [])];
  const named = input.sheets.length > 1;
  const extracted = input.sheets.map((sheet) =>
    extractSheet(
      sheet.rows,
      named ? sheet.name : "",
      input.override
        ? { mapping: input.override, headers: input.primaryHeaders ?? [] }
        : undefined,
    ),
  );
  const primary = input.override
    ? null
    : extracted.reduce<(typeof extracted)[number] | null>(
        (best, current) => (current.items.length > (best?.items.length ?? -1) ? current : best),
        null,
      );
  for (const sheet of extracted) {
    for (const warning of sheet.warnings) {
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }
  const items = extracted.flatMap((sheet) => sheet.items).slice(0, 4000);
  if (items.length === 4000 && !warnings.some((warning) => warning.includes("4000"))) {
    warnings.push("Es wurden nur die ersten 4000 Positionen gelesen.");
  }
  if (items.length === 0) {
    warnings.push("In der Datei wurden keine Bauteilpositionen erkannt.");
  }
  return {
    filename: input.filename,
    kind: input.kind,
    headers: input.override ? (input.primaryHeaders ?? []) : (primary?.headers ?? []),
    mapping: input.override ?? primary?.mapping ?? emptyMapping(),
    items,
    warnings,
    suggestedSupplier: suggestSupplier(input.filename),
  };
}
