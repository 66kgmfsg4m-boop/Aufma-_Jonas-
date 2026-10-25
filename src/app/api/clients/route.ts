import { listClients, upsertClient } from "@/lib/clients";
import { asText } from "@/lib/sanitize";

function fromBody(body: Record<string, unknown>) {
  return {
    name: asText(body.name, 160),
    street: asText(body.street, 160),
    zip: asText(body.zip, 12),
    city: asText(body.city, 80),
    email: asText(body.email, 160),
    phone: asText(body.phone, 40),
    notes: asText(body.notes, 500),
  };
}

export async function GET() {
  return Response.json({ clients: listClients() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const client = upsertClient(fromBody(body));
  if (!client) return Response.json({ error: "Der Kunde braucht einen Namen." }, { status: 400 });
  return Response.json({ client }, { status: 201 });
}
