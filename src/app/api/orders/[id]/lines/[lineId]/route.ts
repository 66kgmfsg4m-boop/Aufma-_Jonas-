import { deleteOrderLine, updateOrderLine } from "@/lib/orders";
import { parseGermanNumber } from "@/lib/parse/text";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const quantity =
    body && typeof body.quantity === "number"
      ? body.quantity
      : body && typeof body.quantity === "string"
        ? parseGermanNumber(body.quantity)
        : null;
  if (quantity == null || quantity <= 0) {
    return Response.json({ error: "Die Menge muss größer als 0 sein." }, { status: 400 });
  }
  const order = updateOrderLine(id, lineId, quantity);
  if (!order) return Response.json({ error: "Diese Position gibt es nicht mehr." }, { status: 404 });
  return Response.json({ order });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; lineId: string }> },
) {
  const { id, lineId } = await context.params;
  const order = deleteOrderLine(id, lineId);
  if (!order) return Response.json({ error: "Diese Position gibt es nicht mehr." }, { status: 404 });
  return Response.json({ order });
}
