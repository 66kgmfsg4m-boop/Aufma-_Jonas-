import { createRequire } from "node:module";
import type { Cell, CellValue } from "exceljs";
import { decodeCsvBuffer, detectDelimiter, parseDelimited } from "@/lib/parse/text";
import type { SheetGrid } from "@/lib/types";

const require = createRequire(import.meta.url);
const { Workbook } = require("exceljs") as typeof import("exceljs");

function valueToString(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1e6) / 1e6);
  }
  if (typeof value === "boolean" || value instanceof Date) return "";
  if (typeof value === "object") {
    if ("result" in value && value.result != null && typeof value.result !== "object") {
      return valueToString(value.result as CellValue);
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text ?? "").join("").trim();
    }
    if ("text" in value && typeof value.text === "string") return value.text.trim();
  }
  return "";
}

function cellToString(cell: Cell): string {
  try {
    const text = cell.text;
    if (typeof text === "string" && text.trim()) return text.replace(/\s+/g, " ").trim();
  } catch {
    // Fall back to the raw cell value when ExcelJS cannot render the text.
  }
  return valueToString(cell.value).replace(/\s+/g, " ").trim();
}

export async function readXlsx(data: Uint8Array): Promise<SheetGrid[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(Buffer.from(data) as unknown as ArrayBuffer);
  const sheets: SheetGrid[] = [];
  workbook.eachSheet((sheet) => {
    let maxColumn = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (_cell, column) => {
        if (column <= 40 && column > maxColumn) maxColumn = column;
      });
    });
    if (maxColumn === 0) return;
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const line: string[] = [];
      for (let column = 1; column <= maxColumn; column += 1) {
        line.push(cellToString(row.getCell(column)));
      }
      if (line.some(Boolean)) rows.push(line);
    });
    if (rows.length > 0) sheets.push({ name: sheet.name || "Tabelle", rows });
  });
  return sheets;
}

export function readCsv(data: Uint8Array, filename: string): SheetGrid[] {
  const text = decodeCsvBuffer(data);
  const rows = parseDelimited(text, detectDelimiter(text));
  if (rows.length === 0) return [];
  return [{ name: filename, rows }];
}

export function fileKind(filename: string): "xlsx" | "csv" | "pdf" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt")) return "csv";
  if (lower.endsWith(".pdf")) return "pdf";
  return null;
}
