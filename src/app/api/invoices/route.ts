import { issueInvoice, listInvoices } from "@/lib/invoices";
import { asText } from "@/lib/sanitize";

export async function GET() {
  return Response.json({ invoices: listInvoices() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = asText(body?.orderId, 80);
  if (!orderId) return Response.json({ error: "Der Auftrag fehlt." }, { status: 400 });
  const issued = issueInvoice(orderId);
  if (!issued) {
    return Response.json(
      { error: "Die Rechnung braucht mindestens eine Position, Stunden oder Kilometer." },
      { status: 400 },
    );
  }
  return Response.json({ id: issued.id, invoice: issued.model }, { status: 201 });
}
