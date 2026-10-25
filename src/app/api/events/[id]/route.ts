import { deleteEvent, updateEvent } from "@/lib/events";
import { asDate, asText } from "@/lib/sanitize";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const event = updateEvent(id, {
    date: asDate(body.date),
    title: asText(body.title, 160),
    clientId: asText(body.clientId, 80),
    orderId: asText(body.orderId, 80),
    notes: asText(body.notes, 500),
  });
  if (!event) return Response.json({ error: "Diesen Termin gibt es nicht mehr." }, { status: 404 });
  return Response.json({ event });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteEvent(id);
  if (!removed) return Response.json({ error: "Diesen Termin gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
