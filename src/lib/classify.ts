import type { PartGroup } from "@/lib/groups";
import { fold } from "@/lib/parse/text";

export const CATEGORY_IDS = [
  "kabel",
  "kanal",
  "klemme",
  "dose",
  "schalter",
  "schutz",
  "abdeckung",
  "rohr",
  "fitting",
  "befestigung",
  "sanitaer",
  "baustoff",
  "sonstiges",
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type Category = {
  id: CategoryId;
  label: string;
  hint: string;
  color: string;
};

export const CATEGORIES: readonly Category[] = [
  { id: "kabel", label: "Kabel", hint: "NYM, NYY, Ölflex", color: "#e2b15a" },
  { id: "kanal", label: "Kanäle", hint: "Kabelkanäle", color: "#5ec8d8" },
  { id: "klemme", label: "Klemmen", hint: "WAGO und Steckklemmen", color: "#f0a05a" },
  { id: "dose", label: "Dosen", hint: "Geräte- und Abzweigdosen", color: "#b48cff" },
  { id: "schalter", label: "Schalter", hint: "Wippen, Steckdosen, Taster", color: "#7dce82" },
  { id: "schutz", label: "Schutz", hint: "LS, FI, Phasenschienen", color: "#f07167" },
  { id: "abdeckung", label: "Abdeckungen", hint: "Rahmen und Streifen", color: "#7eb6ff" },
  { id: "rohr", label: "Rohre", hint: "Installations- und Kupferrohr", color: "#5dcec0" },
  { id: "fitting", label: "Fittings", hint: "Bögen, Muffen, Verschraubungen", color: "#c6d96a" },
  { id: "befestigung", label: "Befestigung", hint: "Schrauben und Dübel", color: "#e6c85c" },
  { id: "sanitaer", label: "Sanitär", hint: "Armaturen und Ventile", color: "#e58ab5" },
  { id: "baustoff", label: "Baustoffe", hint: "Platten, Dämmung, Beton", color: "#d2a48a" },
  { id: "sonstiges", label: "Sonstiges", hint: "ohne erkennbares Gewerk", color: "#b7b1a6" },
];

const RULES: { id: CategoryId; test: RegExp }[] = [
  {
    id: "schutz",
    test: /leitungsschutz|fehlerstrom|fi[\s/-]?schutz|phasenschiene|schutzschalter|\bsicherung\b/,
  },
  { id: "klemme", test: /klemme|\bwago\b/ },
  { id: "kanal", test: /kabelkanal|installationskanal|bruestungskanal|\bkanal\b/ },
  {
    id: "kabel",
    test: /\bnym\b|\bnyy\b|oelflex|mantelleitung|erdkabel|\bkabel\b/,
  },
  { id: "abdeckung", test: /abdeck|beruehrungsschutz/ },
  { id: "schalter", test: /schalter|wippe|steckdose|stromstoss|taster|\bcee\b/ },
  { id: "dose", test: /dose/ },
  { id: "rohr", test: /rohr/ },
  { id: "fitting", test: /fitting|\bbogen\b|muffe|verschraub|verschlus+schraub|pressfitting|kupplung/ },
  { id: "befestigung", test: /schraube|duebel|nagelduebel|\bnagel\b|schelle/ },
  { id: "baustoff", test: /gips|\bosb\b|daemm|beton|schalung|tiefengrund|acryl|fugen|gipskarton/ },
  { id: "sanitaer", test: /armatur|ventil(?!ator)|waschtisch|spuelkasten|sifon/ },
];

const byId = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoryById(id: CategoryId): Category {
  const category = byId.get(id);
  if (!category) return CATEGORIES[CATEGORIES.length - 1] as Category;
  return category;
}

export function classifyPart(name: string, articleNumber = ""): CategoryId {
  const text = fold(`${name} ${articleNumber}`);
  for (const rule of RULES) {
    if (rule.test.test(text)) return rule.id;
  }
  return "sonstiges";
}

export type CategoryBucket = {
  category: Gewerk;
  groups: PartGroup[];
};

export type Gewerk = {
  id: string;
  label: string;
  hint: string;
  color: string;
};

export function groupCategoryId(group: PartGroup, categories: readonly Gewerk[]): string {
  const known = new Set(categories.map((category) => category.id));
  for (const offer of group.offers) {
    if (offer.categoryId && known.has(offer.categoryId)) return offer.categoryId;
  }
  const auto = classifyPart(group.name, group.articleNumber);
  if (known.has(auto)) return auto;
  if (known.has("sonstiges")) return "sonstiges";
  return categories[categories.length - 1]?.id ?? "sonstiges";
}

export function bucketGroups(
  groups: PartGroup[],
  categories: readonly Gewerk[] = CATEGORIES,
  includeEmpty = false,
): CategoryBucket[] {
  const map = new Map<string, PartGroup[]>();
  for (const group of groups) {
    const id = groupCategoryId(group, categories);
    const list = map.get(id);
    if (list) list.push(group);
    else map.set(id, [group]);
  }
  return categories.flatMap((category) => {
    const grouped = map.get(category.id) ?? [];
    if (grouped.length === 0 && !includeEmpty) return [];
    return [{ category, groups: grouped }];
  });
}
