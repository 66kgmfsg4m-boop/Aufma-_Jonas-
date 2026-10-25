import { deleteDocument } from "@/lib/db";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteDocument(id);
  if (!removed) return Response.json({ error: "Diese Quelle gibt es nicht mehr." }, { status: 404 });
  return Response.json({ ok: true });
}
