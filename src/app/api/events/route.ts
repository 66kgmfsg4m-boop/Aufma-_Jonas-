import { createEvent, listEvents } from "@/lib/events";
import { asDate, asText } from "@/lib/sanitize";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = asDate(url.searchParams.get("from") ?? "");
  const to = asDate(url.searchParams.get("to") ?? "");
  if (!from || !to) return Response.json({ error: "Der Zeitraum fehlt." }, { status: 400 });
  return Response.json({ events: listEvents(from, to) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const event = createEvent({
    date: asDate(body.date),
    title: asText(body.title, 160),
    clientId: asText(body.clientId, 80),
    orderId: asText(body.orderId, 80),
    notes: asText(body.notes, 500),
  });
  if (!event) return Response.json({ error: "Der Termin braucht Datum und Titel." }, { status: 400 });
  return Response.json({ event }, { status: 201 });
}
