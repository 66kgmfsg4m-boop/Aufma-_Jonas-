import { importDocument } from "@/lib/db";
import { asDocType, asText, sanitizeItems } from "@/lib/sanitize";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const supplier = asText(body.supplier, 120);
  const docType = asDocType(body.docType);
  const filename = asText(body.filename, 180) || "Import";
  const items = sanitizeItems(body.items);
  if (!supplier) {
    return Response.json({ error: "Bitte den Großhändler eintragen." }, { status: 400 });
  }
  if (!docType) {
    return Response.json({ error: "Bitte Rechnung oder Preiskatalog wählen." }, { status: 400 });
  }
  if (!items || items.length === 0) {
    return Response.json({ error: "Keine Position mit Preis ausgewählt." }, { status: 400 });
  }
  const document = importDocument({ filename, supplier, docType, items });
  return Response.json({ document });
}
