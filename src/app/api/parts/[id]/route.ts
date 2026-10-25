import { deletePart, getPart, relatedParts, updatePart } from "@/lib/db";
import { asPrice, asText } from "@/lib/sanitize";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const part = getPart(id);
  if (!part) return Response.json({ error: "Dieses Bauteil gibt es nicht mehr." }, { status: 404 });
  return Response.json({ part, related: relatedParts(id) });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const updated = updatePart(id, {
    articleNumber: asText(body.articleNumber, 80),
    name: asText(body.name, 300),
    unit: asText(body.unit, 24),
    unitPrice: asPrice(body.unitPrice),
  });
  if (!updated) {
    return Response.json(
      { error: "Das Bauteil braucht eine Bezeichnung oder Artikelnummer." },
      { status: 400 },
    );
  }
  return Response.json({ part: updated, related: relatedParts(id) });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deletePart(id);
  if (!removed) return Response.json({ error: "Dieses Bauteil gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
