import { fold } from "@/lib/parse/text";
import type { Part } from "@/lib/types";

export type PartGroup = {
  key: string;
  articleNumber: string;
  name: string;
  unit: string;
  offers: Part[];
};

export function groupParts(parts: Part[]): PartGroup[] {
  const groups = new Map<string, Part[]>();
  const order: string[] = [];
  for (const part of parts) {
    const article = part.articleNumber.trim();
    const key = article ? fold(article) : `id:${part.id}`;
    const existing = groups.get(key);
    if (existing) existing.push(part);
    else {
      groups.set(key, [part]);
      order.push(key);
    }
  }
  return order.map((key) => {
    const offers = [...(groups.get(key) ?? [])].sort(
      (left, right) => (left.unitPrice ?? Number.POSITIVE_INFINITY) - (right.unitPrice ?? Number.POSITIVE_INFINITY),
    );
    const name = [...offers].sort((left, right) => right.name.length - left.name.length)[0]?.name ?? "";
    return {
      key,
      articleNumber: offers.find((offer) => offer.articleNumber.trim())?.articleNumber ?? "",
      name: name || "Ohne Bezeichnung",
      unit: offers.find((offer) => offer.unit)?.unit ?? "",
      offers,
    };
  });
}
