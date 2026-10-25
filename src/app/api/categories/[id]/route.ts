import { deleteCategory, updateCategory } from "@/lib/categories";
import { asText } from "@/lib/sanitize";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const updated = updateCategory(id, {
    label: typeof body.label === "string" ? asText(body.label, 40) : undefined,
    color: typeof body.color === "string" ? asText(body.color, 7) : undefined,
    hint: typeof body.hint === "string" ? asText(body.hint, 80) : undefined,
  });
  if (!updated) return Response.json({ error: "Dieses Gewerk gibt es nicht mehr." }, { status: 404 });
  return Response.json({ category: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = deleteCategory(id);
  if (!removed) {
    return Response.json(
      { error: "Das letzte Gewerk bleibt stehen. Lege zuerst ein anderes an." },
      { status: 400 },
    );
  }
  return Response.json({ ok: true });
}
