import { deleteClient, updateClient } from "@/lib/clients";
import { asText } from "@/lib/sanitize";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const client = updateClient(id, {
    name: asText(body.name, 160),
    street: asText(body.street, 160),
    zip: asText(body.zip, 12),
    city: asText(body.city, 80),
    email: asText(body.email, 160),
    phone: asText(body.phone, 40),
    notes: asText(body.notes, 500),
  });
  if (!client) return Response.json({ error: "Diesen Kunden gibt es nicht mehr." }, { status: 404 });
  return Response.json({ client });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteClient(id);
  if (!removed) return Response.json({ error: "Diesen Kunden gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
