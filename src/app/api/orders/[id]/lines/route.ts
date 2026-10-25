import { addOrderLine } from "@/lib/orders";
import { asText } from "@/lib/sanitize";
import { parseGermanNumber } from "@/lib/parse/text";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const partId = asText(body.partId, 80);
  const quantity =
    typeof body.quantity === "number"
      ? body.quantity
      : typeof body.quantity === "string"
        ? parseGermanNumber(body.quantity)
        : null;
  if (!partId || quantity == null || quantity <= 0) {
    return Response.json({ error: "Menge und Bauteil fehlen." }, { status: 400 });
  }
  const order = addOrderLine(id, partId, quantity);
  if (!order) {
    return Response.json(
      { error: "Das Bauteil hat keinen verwendbaren Einkaufspreis oder der Auftrag fehlt." },
      { status: 400 },
    );
  }
  return Response.json({ order });
}
