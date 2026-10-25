import { createOrder, listOrders } from "@/lib/orders";
import { asText } from "@/lib/sanitize";

export async function GET() {
  return Response.json({ orders: listOrders() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const title = asText(body.title, 160);
  if (!title) return Response.json({ error: "Der Auftrag braucht einen Namen." }, { status: 400 });
  const order = createOrder({ title, customer: asText(body.customer, 160) });
  return Response.json({ order }, { status: 201 });
}
