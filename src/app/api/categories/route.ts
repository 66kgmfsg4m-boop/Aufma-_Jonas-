import { createCategory, listCategories } from "@/lib/categories";
import { asText } from "@/lib/sanitize";

export async function GET() {
  return Response.json({ categories: listCategories() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const created = createCategory({
    label: asText(body.label, 40),
    color: asText(body.color, 7),
  });
  if (!created) return Response.json({ error: "Das Gewerk braucht einen Namen." }, { status: 400 });
  return Response.json({ category: created }, { status: 201 });
}
