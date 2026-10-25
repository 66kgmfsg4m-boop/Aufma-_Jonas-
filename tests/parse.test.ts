import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";
import { buildParsed } from "../src/lib/parse/build.ts";
import { readCsv, readXlsx } from "../src/lib/parse/spreadsheet.ts";
import { readPdf } from "../src/lib/parse/pdf.ts";
import { parseGermanNumber } from "../src/lib/parse/text.ts";
import { extractSheet, parseFreeformLine } from "../src/lib/parse/items.ts";

describe("german numbers", () => {
  it("reads catalog and invoice formats", () => {
    assert.equal(parseGermanNumber("0,89"), 0.89);
    assert.equal(parseGermanNumber("1.234,56 €"), 1234.56);
    assert.equal(parseGermanNumber("1.250"), 1250);
    assert.equal(parseGermanNumber("0.89"), 0.89);
    assert.equal(parseGermanNumber("148"), 148);
    assert.equal(parseGermanNumber("12,5"), 12.5);
    assert.equal(parseGermanNumber("—"), null);
    assert.equal(parseGermanNumber("19,00 %"), null);
  });
});

describe("spreadsheet extraction", () => {
  it("maps german headers and converts a price basis of 100", () => {
    const extracted = extractSheet([
      ["Art.-Nr.", "Bezeichnung", "ME", "Einzelpreis", "PE", "Menge"],
      ["SBS-35", "Schnellbauschraube 3,5x35", "Stk", "4,90", "100", "1"],
      ["NYM-J315", "NYM-J 3x1,5 Mantelleitung", "m", "0,89", "1", ""],
      ["", "Zwischensumme", "", "5,79", "", ""],
    ]);
    assert.equal(extracted.items.length, 2);
    const screw = extracted.items.find((item) => item.articleNumber === "SBS-35");
    assert.ok(screw);
    assert.equal(screw.unit, "Stk");
    assert.ok(Math.abs((screw.unitPrice ?? 0) - 0.049) < 0.0001);
    assert.equal(screw.priceBasis, 100);
    const cable = extracted.items.find((item) => item.articleNumber === "NYM-J315");
    assert.equal(cable?.unitPrice, 0.89);
    assert.equal(cable?.unit, "m");
  });

  it("prefers EK over VK", () => {
    const extracted = extractSheet([
      ["Artikelnummer", "Bezeichnung", "Einheit", "EK", "VK"],
      ["LS-B16", "Leitungsschutzschalter B16", "Stk", "4,85", "8,90"],
    ]);
    assert.equal(extracted.items[0]?.unitPrice, 4.85);
  });

  it("derives the unit price when only a total is present", () => {
    const extracted = extractSheet([
      ["Artikel", "Bezeichnung", "Menge", "Einheit", "Gesamtpreis"],
      ["CU-15", "Kupferrohr 15x1", "10", "m", "67,00"],
    ]);
    assert.equal(extracted.items[0]?.unitPrice, 6.7);
    assert.match(extracted.items[0]?.note ?? "", /berechnet/);
  });

  it("reads a semicolon csv", () => {
    const csv = "Artikelnummer;Bezeichnung;Einheit;Preis\nDOS-60;Hohlwanddose;Stk;0,42\n";
    const sheets = readCsv(new TextEncoder().encode(csv), "Holt.csv");
    const parsed = buildParsed({ filename: "Holt.csv", kind: "spreadsheet", sheets });
    assert.equal(parsed.items[0]?.articleNumber, "DOS-60");
    assert.equal(parsed.items[0]?.unitPrice, 0.42);
    assert.equal(parsed.suggestedSupplier, "Holt");
  });

  it("reads an xlsx catalog", async () => {
    const require = createRequire(import.meta.url);
    const { Workbook } = require("exceljs") as typeof import("exceljs");
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Preise");
    sheet.addRow(["Artikelnummer", "Bezeichnung", "Einheit", "Nettopreis"]);
    sheet.addRow(["KAN-6040", "Kabelkanal 60x40 mm", "m", 3.2]);
    const buffer = await workbook.xlsx.writeBuffer();
    const sheets = await readXlsx(new Uint8Array(buffer as ArrayBuffer));
    const parsed = buildParsed({
      filename: "Elektro_Wagner_Katalog_2026.xlsx",
      kind: "spreadsheet",
      sheets,
    });
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.unitPrice, 3.2);
    assert.equal(parsed.items[0]?.unit, "m");
    assert.equal(parsed.suggestedSupplier, "Elektro Wagner");
  });
});

describe("invoice lines", () => {
  it("reads a freeform invoice row", () => {
    const item = parseFreeformLine("1 47110815 NYM-J 3x1,5 Mantelleitung 120 m 0,89 106,80");
    assert.ok(item);
    assert.equal(item.articleNumber, "47110815");
    assert.match(item.name, /NYM-J 3x1,5/);
    assert.equal(item.unit, "m");
    assert.equal(item.quantity, 120);
    assert.equal(item.unitPrice, 0.89);
    assert.equal(item.totalPrice, 106.8);
  });

  it("detects a hidden price basis of 100 from the totals", () => {
    const extracted = extractSheet([
      ["Pos", "Art.-Nr.", "Bezeichnung", "Menge", "ME", "EP", "GP"],
      ["1", "SBS-35", "Schnellbauschraube 3,5x35", "1000", "Stk", "4,90", "49,00"],
    ]);
    const item = extracted.items[0];
    assert.ok(item);
    assert.equal(item.priceBasis, 100);
    assert.ok(Math.abs((item.unitPrice ?? 0) - 0.049) < 0.0001);
  });
});

describe("pdf", () => {
  it("extracts a positioned invoice table", async () => {
    const stream = [
      "BT",
      "/F1 10 Tf",
      "1 0 0 1 40 760 Tm (Art.-Nr.) Tj",
      "1 0 0 1 150 760 Tm (Bezeichnung) Tj",
      "1 0 0 1 320 760 Tm (Menge) Tj",
      "1 0 0 1 390 760 Tm (ME) Tj",
      "1 0 0 1 450 760 Tm (EP) Tj",
      "1 0 0 1 510 760 Tm (GP) Tj",
      "1 0 0 1 40 742 Tm (47110815) Tj",
      "1 0 0 1 150 742 Tm (NYM-J 3x1,5) Tj",
      "1 0 0 1 320 742 Tm (120) Tj",
      "1 0 0 1 390 742 Tm (m) Tj",
      "1 0 0 1 450 742 Tm (0,89) Tj",
      "1 0 0 1 510 742 Tm (106,80) Tj",
      "ET",
    ].join("\n");
    const pdf = buildPdf(stream);
    const read = await readPdf(pdf);
    const parsed = buildParsed({
      filename: "Rechnung-Wagner.pdf",
      kind: "pdf",
      sheets: read.sheets,
      warnings: read.warnings,
    });
    assert.equal(parsed.warnings.some((warning) => warning.includes("Scan")), false);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.articleNumber, "47110815");
    assert.equal(parsed.items[0]?.unit, "m");
    assert.equal(parsed.items[0]?.unitPrice, 0.89);
    assert.equal(parsed.items[0]?.quantity, 120);
  });
});

function buildPdf(contentStream: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(contentStream)} >>\nstream\n${contentStream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(body));
}
