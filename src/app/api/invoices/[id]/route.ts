import { deleteInvoice, getInvoice } from "@/lib/invoices";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const invoice = getInvoice(id);
  if (!invoice) return Response.json({ error: "Diese Rechnung gibt es nicht mehr." }, { status: 404 });
  return Response.json(invoice);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteInvoice(id);
  if (!removed) return Response.json({ error: "Diese Rechnung gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
