import fs from "node:fs";
import path from "node:path";
import { saveSettings, templateFile } from "@/lib/settings";

export async function GET() {
  const file = templateFile();
  if (!fs.existsSync(file)) {
    return Response.json({ error: "Noch keine Rechnungsvorlage hochgeladen." }, { status: 404 });
  }
  const bytes = fs.readFileSync(file);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"vorlage.pdf\"",
    },
  });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Bitte eine PDF-Datei wählen." }, { status: 400 });
  }
  const name = file.name.toLowerCase();
  if (file.type && file.type !== "application/pdf" && !name.endsWith(".pdf")) {
    return Response.json({ error: "Die Vorlage muss eine PDF sein." }, { status: 400 });
  }
  if (!name.endsWith(".pdf")) {
    return Response.json({ error: "Die Vorlage muss eine PDF sein." }, { status: 400 });
  }
  if (file.size > 8_000_000) {
    return Response.json({ error: "Die Vorlage ist größer als 8 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return Response.json({ error: "Die Datei ist keine PDF." }, { status: 400 });
  }
  const target = templateFile();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  const settings = saveSettings({ templateName: file.name.slice(0, 180) });
  return Response.json({ settings });
}

export async function DELETE() {
  const target = templateFile();
  if (fs.existsSync(target)) fs.unlinkSync(target);
  const settings = saveSettings({ templateName: "" });
  return Response.json({ settings });
}
