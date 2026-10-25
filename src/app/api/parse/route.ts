import { buildParsed } from "@/lib/parse/build";
import { readPdf } from "@/lib/parse/pdf";
import { fileKind, readCsv, readXlsx } from "@/lib/parse/spreadsheet";
import { isMapping, loadParse, saveParse, type StoredParse } from "@/lib/parse/store";

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      parseId?: unknown;
      mapping?: unknown;
    } | null;
    if (!body || typeof body.parseId !== "string" || !isMapping(body.mapping)) {
      return Response.json({ error: "Die Spaltenzuordnung ist unvollständig." }, { status: 400 });
    }
    try {
      const stored = loadParse(body.parseId);
      const result = buildParsed({
        filename: stored.filename,
        kind: stored.kind,
        sheets: stored.sheets,
        warnings: stored.warnings.filter((warning) => !warning.includes("keine Bauteilpositionen")),
        primaryHeaders: stored.primaryHeaders,
        override: body.mapping,
      });
      return Response.json({ ...result, parseId: stored.id });
    } catch {
      return Response.json(
        { error: "Diese Datei liegt nicht mehr im Zwischenspeicher. Bitte erneut hochladen." },
        { status: 404 },
      );
    }
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Bitte eine Datei auswählen." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Die Datei ist größer als 20 MB." }, { status: 400 });
  }
  const kind = fileKind(file.name);
  if (!kind) {
    return Response.json(
      {
        error:
          "Dieses Format wird nicht gelesen. Bitte PDF, XLSX oder CSV verwenden. Ältere .xls-Dateien vorher als .xlsx speichern.",
      },
      { status: 400 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const warnings: string[] = [];
    const sheets =
      kind === "xlsx"
        ? await readXlsx(bytes)
        : kind === "csv"
          ? readCsv(bytes, file.name)
          : await readPdf(bytes).then((pdf) => {
              warnings.push(...pdf.warnings);
              return pdf.sheets;
            });
    if (sheets.length === 0 && !warnings.some((warning) => warning.includes("Scan"))) {
      warnings.push("Die Datei enthält kein lesbares Blatt.");
    }
    const parsed = buildParsed({
      filename: file.name,
      kind: kind === "pdf" ? "pdf" : "spreadsheet",
      sheets,
      warnings,
    });
    const stored: StoredParse = {
      id: crypto.randomUUID(),
      filename: file.name,
      kind: parsed.kind,
      createdAt: Date.now(),
      primaryHeaders: parsed.headers,
      sheets,
      warnings,
    };
    saveParse(stored);
    return Response.json({ ...parsed, parseId: stored.id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Die Datei konnte nicht gelesen werden." }, { status: 422 });
  }
}
