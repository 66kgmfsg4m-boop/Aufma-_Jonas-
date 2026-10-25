import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

describe("invoice continuations", () => {
  it("maps warenbezeichnung and keeps the manufacturer in the name", () => {
    const extracted = extractSheet([
      ["Hersteller", "Artikelnummer", "Warenbezeichnung", "Menge", "Preis", "Rabatt", "Gesamt"],
      ["Hager", "04.KZ059", "Hager KZ059 Berührungsschutzabdeckung", "5,00", "1,28", "", "6,40"],
      ["", "oxgutschein", "Emarsys Welcome 10€ Gutschein", "1,00", "-10,00", "", "-10,00"],
      ["Jonas Zimmer", "", "", "", "", "", ""],
      ["Lerchenweg 6", "", "", "", "", "", ""],
    ]);
    assert.equal(extracted.mapping.name, 2);
    assert.equal(extracted.items.length, 1);
    assert.equal(extracted.items[0]?.articleNumber, "04.KZ059");
    assert.match(extracted.items[0]?.name ?? "", /Berührungsschutzabdeckung/);
    assert.equal(extracted.items[0]?.unitPrice, 1.28);
    assert.equal(extracted.items[0]?.unit, "Stk");
  });

  it("merges pack lines and divides the pack price once", () => {
    const extracted = extractSheet([
      ["Pos.", "Artikelnr.", "Menge", "Bezeichnung", "MwSt.", "Einzelpreis", "Gesamtpreis"],
      ["1", "552451", "1", "Abzweigdose, PVC, IP54", "19%", "6,50", "6,50"],
      ["", "", "", "10 Stück", "", "", ""],
      ["2", "550514", "1", "Abdeckstreifen, 12 Einheiten", "19%", "1,62", "1,62"],
      ["", "", "", "lichtgrau", "", "", ""],
      ["3", "551377", "1", "Hohlwanddose Ø 68mm", "19%", "11,88", "11,88"],
      ["", "", "", "25 St.", "", "", ""],
    ]);
    const box = extracted.items.find((item) => item.articleNumber === "552451");
    assert.ok(box);
    assert.equal(box.unitPrice, 0.65);
    assert.equal(box.unit, "Stk");
    assert.match(box.name, /10 Stück/);
    const strip = extracted.items.find((item) => item.articleNumber === "550514");
    assert.equal(strip?.unitPrice, 1.62);
    assert.match(strip?.name ?? "", /lichtgrau/);
    const dose = extracted.items.find((item) => item.articleNumber === "551377");
    assert.equal(dose?.unitPrice, 0.4752);
    assert.equal(extracted.items.length, 3);
  });

  it("turns meterware into a meter price and leaves stick goods whole", () => {
    const extracted = extractSheet([
      ["Hersteller", "Artikelnummer", "Warenbezeichnung", "Menge", "Preis", "Rabatt", "Gesamt"],
      ["Lapp Kabel", "X7633320-100", "Ölflex Classic 110 Meterware 100", "1,00", "128,90", "", "128,90"],
      ["", "Bestellte Menge 1x100 Meter", "", "", "", "", ""],
      ["", "", "Zuschnittkosten von 10.9 € pro Stück enthalten", "", "", "", ""],
      ["Fränkische", "28.22220020", "FPKu-EM-F 20 2m Stangenrohr", "5,00", "2,18", "", "10,90"],
      ["diverse", "00317", "NYM-J 3x1,5mm² 100 Meter", "1,00", "92,08", "", "92,08"],
    ]);
    const cable = extracted.items.find((item) => item.articleNumber === "X7633320-100");
    assert.ok(cable);
    assert.equal(cable.unit, "m");
    assert.equal(cable.unitPrice, 1.289);
    assert.match(cable.name, /1x100 Meter/);
    assert.match(cable.name, /Zuschnittkosten/);
    const stick = extracted.items.find((item) => item.articleNumber === "28.22220020");
    assert.equal(stick?.unit, "Stk");
    assert.equal(stick?.unitPrice, 2.18);
    const nym = extracted.items.find((item) => item.articleNumber === "00317");
    assert.equal(nym?.unit, "m");
    assert.equal(nym?.unitPrice, 0.9208);
    assert.equal(extracted.items.some((item) => /lerchenweg|gutschein/i.test(item.name)), false);
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

  it("reads the Pollin and Wandelt example invoices", async () => {
    const pollin = await readExample("examples/Rechnung.pdf", "Rechnung.pdf");
    const relay = pollin.items.find((item) => item.articleNumber === "554730");
    assert.ok(relay);
    assert.match(relay.name, /ELTAKO/);
    assert.match(relay.name, /16 A/);
    assert.equal(relay.unitPrice, 13.55);
    assert.equal(relay.unit, "Stk");
    const box = pollin.items.find((item) => item.articleNumber === "552451");
    assert.equal(box?.unitPrice, 0.65);
    const dose = pollin.items.find((item) => item.articleNumber === "551377");
    assert.equal(dose?.unitPrice, 0.4752);
    const modules = pollin.items.find((item) => item.articleNumber === "550514");
    assert.equal(modules?.unitPrice, 1.62);
    const wago = pollin.items.find((item) => item.articleNumber === "550958");
    assert.equal(wago?.unitPrice, 0.135);
    assert.equal(pollin.items.some((item) => /lerchenweg|gutschein|versandkosten|jonas zimmer/i.test(`${item.name} ${item.articleNumber}`)), false);

    const wandelt = await readExample("examples/Rechnung42295692.pdf", "Rechnung42295692.pdf");
    const cover = wandelt.items.find((item) => item.articleNumber === "04.KZ059");
    assert.ok(cover);
    assert.match(cover.name, /Berührungsschutzabdeckung/);
    assert.equal(cover.unitPrice, 1.28);
    assert.equal(cover.unit, "Stk");
    const oil = wandelt.items.find((item) => item.articleNumber === "X7633320-100");
    assert.equal(oil?.unit, "m");
    assert.equal(oil?.unitPrice, 1.289);
    const stick = wandelt.items.find((item) => item.articleNumber === "28.22220020");
    assert.equal(stick?.unit, "Stk");
    assert.equal(stick?.unitPrice, 2.18);
    const nym = wandelt.items.find((item) => item.articleNumber === "00317");
    assert.equal(nym?.unit, "m");
    assert.equal(nym?.unitPrice, 0.9208);
    assert.equal(wandelt.items.some((item) => /lerchenweg|gutschein|oxgutschein|askay/i.test(`${item.name} ${item.articleNumber}`)), false);
  });

  it("reads an Amazon invoice whose net price shares a cell with the tax rate", async () => {
    const amazon = await readExample("examples/amazon-rechnung.pdf", "amazon-rechnung.pdf");
    const socket = amazon.items.find((item) => item.articleNumber === "B09FM2F6J9");
    assert.ok(socket);
    assert.match(socket.name, /Neozed/);
    assert.equal(socket.unitPrice, 23.49);
    assert.equal(socket.quantity, 1);
    assert.equal(amazon.items.some((item) => /versand/i.test(item.name)), false);
  });
});

async function readExample(file: string, filename: string) {
  const read = await readPdf(new Uint8Array(readFileSync(file)));
  return buildParsed({ filename, kind: "pdf", sheets: read.sheets, warnings: read.warnings });
}

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
