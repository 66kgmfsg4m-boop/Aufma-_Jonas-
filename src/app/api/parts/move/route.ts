import { getCategory } from "@/lib/categories";
import { assignCategories } from "@/lib/db";
import { asText } from "@/lib/sanitize";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.ids)) {
    return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  }
  const categoryId = asText(body.categoryId, 80);
  if (!categoryId || !getCategory(categoryId)) {
    return Response.json({ error: "Dieses Gewerk gibt es nicht." }, { status: 400 });
  }
  const ids = body.ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 80)
    .slice(0, 100);
  if (ids.length === 0) return Response.json({ error: "Keine Bauteile ausgewählt." }, { status: 400 });
  const changed = assignCategories(ids, categoryId);
  return Response.json({ changed, categoryId });
}
