import { deleteOrder, getOrder, updateOrder } from "@/lib/orders";
import { asText } from "@/lib/sanitize";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const order = getOrder(id);
  if (!order) return Response.json({ error: "Diesen Auftrag gibt es nicht mehr." }, { status: 404 });
  return Response.json({ order });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const updated = updateOrder(id, {
    title: asText(body.title, 160),
    customer: asText(body.customer, 160),
  });
  if (!updated) return Response.json({ error: "Der Auftrag braucht einen Namen." }, { status: 400 });
  return Response.json({ order: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteOrder(id);
  if (!removed) return Response.json({ error: "Diesen Auftrag gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
