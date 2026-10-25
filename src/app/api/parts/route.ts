import { getCategory } from "@/lib/categories";
import { createManualPart } from "@/lib/db";
import { asPrice, asText } from "@/lib/sanitize";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const articleNumber = asText(body.articleNumber, 80);
  const name = asText(body.name, 300);
  const unitPrice = asPrice(body.unitPrice);
  if ((!articleNumber && !name) || unitPrice == null || unitPrice <= 0) {
    return Response.json(
      { error: "Die Position braucht eine Bezeichnung oder Artikelnummer und einen Einkaufspreis." },
      { status: 400 },
    );
  }
  const categoryId = asText(body.categoryId, 80);
  if (categoryId && !getCategory(categoryId)) {
    return Response.json({ error: "Dieses Gewerk gibt es nicht." }, { status: 400 });
  }
  const part = createManualPart({
    articleNumber,
    name,
    unit: asText(body.unit, 24),
    unitPrice,
    supplier: asText(body.supplier, 120),
    categoryId: categoryId || null,
  });
  return Response.json({ part }, { status: 201 });
}
