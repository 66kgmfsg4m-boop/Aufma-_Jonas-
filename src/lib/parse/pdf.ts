import { mappingFromHeaders } from "@/lib/parse/columns";
import type { SheetGrid } from "@/lib/types";

type Glyph = { text: string; x: number; end: number; y: number; size: number };
type Cell = { text: string; x: number; end: number };

function isTextItem(item: unknown): item is {
  str: string;
  transform: number[];
  width?: number;
} {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item &&
    Array.isArray((item as { transform: unknown }).transform)
  );
}

function clusterRows(glyphs: Glyph[]): Cell[][] {
  const sorted = [...glyphs].sort((left, right) => right.y - left.y || left.x - right.x);
  const lines: Glyph[][] = [];
  for (const glyph of sorted) {
    const tolerance = Math.max(2.2, glyph.size * 0.35);
    const line = lines.find((entry) => Math.abs((entry[0]?.y ?? glyph.y) - glyph.y) <= tolerance);
    if (line) line.push(glyph);
    else lines.push([glyph]);
  }
  return lines
    .map((line) => {
      line.sort((left, right) => left.x - right.x);
      const cells: Cell[] = [];
      for (const glyph of line) {
        const last = cells[cells.length - 1];
        const gap = last ? glyph.x - last.end : Number.POSITIVE_INFINITY;
        const threshold = Math.max(8, glyph.size * 0.9);
        if (!last || gap > threshold) {
          cells.push({ text: glyph.text, x: glyph.x, end: glyph.end });
          continue;
        }
        const space = gap > Math.max(1.2, glyph.size * 0.18) ? " " : "";
        last.text += space + glyph.text;
        last.end = Math.max(last.end, glyph.end);
      }
      return cells
        .map((cell) => ({ ...cell, text: cell.text.replace(/\s+/g, " ").trim() }))
        .filter((cell) => cell.text);
    })
    .filter((row) => row.length > 0);
}

function headerIndex(rows: Cell[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < Math.min(rows.length, 25); index += 1) {
    const scored = mappingFromHeaders(rows[index]?.map((cell) => cell.text) ?? []);
    if (scored.score > bestScore) {
      bestScore = scored.score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function alignRow(template: Cell[], row: Cell[]): string[] {
  const centers = template.map((cell) => (cell.x + cell.end) / 2);
  const line = Array.from({ length: template.length }, () => "");
  for (const cell of row) {
    const center = (cell.x + cell.end) / 2;
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    centers.forEach((value, column) => {
      const delta = Math.abs(center - value);
      if (delta < distance) {
        distance = delta;
        best = column;
      }
    });
    const left = best === 0 ? Number.NEGATIVE_INFINITY : (centers[best - 1]! + centers[best]!) / 2;
    const right =
      best === centers.length - 1
        ? Number.POSITIVE_INFINITY
        : (centers[best]! + centers[best + 1]!) / 2;
    if (center < left || center >= right) continue;
    line[best] = line[best] ? `${line[best]} ${cell.text}` : cell.text;
  }
  return line;
}

function sameRow(left: string[], right: string[]): boolean {
  const a = left.map((cell) => cell.trim().toLowerCase()).filter(Boolean).join("|");
  const b = right.map((cell) => cell.trim().toLowerCase()).filter(Boolean).join("|");
  return a.length > 0 && a === b;
}

export async function readPdf(data: Uint8Array): Promise<{ sheets: SheetGrid[]; warnings: string[] }> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const warnings: string[] = [];
  try {
    const pageCount = Math.min(pdf.numPages, 40);
    if (pdf.numPages > 40) warnings.push("Es wurden nur die ersten 40 Seiten gelesen.");
    let characters = 0;
    let template: Cell[] | null = null;
    const rows: string[][] = [];
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const glyphs: Glyph[] = [];
      for (const item of content.items) {
        if (!isTextItem(item)) continue;
        characters += item.str.trim().length;
        if (!item.str.trim()) continue;
        const x = item.transform[4] ?? 0;
        const y = item.transform[5] ?? 0;
        const size = Math.abs(item.transform[0] ?? 0) || 10;
        glyphs.push({
          text: item.str,
          x,
          y,
          size,
          end: x + (item.width ?? item.str.length * size * 0.45),
        });
      }
      const clustered = clusterRows(glyphs);
      const found = headerIndex(clustered);
      if (found >= 0) template = clustered[found] ?? template;
      if (!template) {
        rows.push(...clustered.map((row) => row.map((cell) => cell.text)));
        continue;
      }
      const headerTexts = template.map((cell) => cell.text);
      if (!rows.some((row) => sameRow(row, headerTexts))) rows.push(headerTexts);
      for (const row of clustered) {
        const aligned = alignRow(template, row);
        if (sameRow(aligned, headerTexts)) continue;
        if (aligned.some(Boolean)) rows.push(aligned);
      }
    }
    if (characters < 40) {
      warnings.push(
        "In dieser PDF steht kein auslesbarer Text. Vermutlich ist es ein Scan. Bitte eine digitale PDF, Excel oder CSV verwenden.",
      );
      return { sheets: [], warnings };
    }
    return { sheets: rows.length > 0 ? [{ name: "PDF", rows }] : [], warnings };
  } finally {
    const closable = pdf as { destroy?: () => Promise<void> | void };
    if (typeof closable.destroy === "function") await closable.destroy();
  }
}
