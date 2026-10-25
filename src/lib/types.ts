export type DocType = "rechnung" | "katalog";

export type Field =
  | "article"
  | "name"
  | "unit"
  | "unitPrice"
  | "quantity"
  | "totalPrice"
  | "priceBasis";

export type ColumnMapping = Record<Field, number | null>;

export type Confidence = "hoch" | "mittel" | "niedrig";

export type ExtractedItem = {
  id: string;
  articleNumber: string;
  name: string;
  unit: string;
  unitPrice: number | null;
  quantity: number | null;
  totalPrice: number | null;
  priceBasis: number;
  currency: "EUR";
  confidence: Confidence;
  note: string;
  sheet: string;
};

export type SheetGrid = {
  name: string;
  rows: string[][];
};

export type ParseResult = {
  parseId: string;
  filename: string;
  kind: "spreadsheet" | "pdf";
  headers: string[];
  mapping: ColumnMapping;
  items: ExtractedItem[];
  warnings: string[];
  suggestedSupplier: string;
};

export type Part = {
  id: string;
  documentId: string;
  articleNumber: string;
  name: string;
  unit: string;
  unitPrice: number | null;
  quantity: number | null;
  totalPrice: number | null;
  priceBasis: number;
  currency: string;
  supplier: string;
  docType: DocType;
  sourceFile: string;
  importedAt: string;
};

export type PriceDocument = {
  id: string;
  filename: string;
  docType: DocType;
  supplier: string;
  uploadedAt: string;
  itemCount: number;
};

export type LibraryStats = {
  partCount: number;
  supplierCount: number;
  documentCount: number;
  latestImport: string | null;
  suppliers: { name: string; count: number }[];
};

export type SearchResponse = {
  items: Part[];
  total: number;
  mode: "recent" | "search";
};

export type OrderLine = {
  id: string;
  orderId: string;
  partId: string;
  articleNumber: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number;
  unitSell: number;
  lineTotal: number;
  supplier: string;
  sourceFile: string;
  position: number;
};

export type JobOrder = {
  id: string;
  seq: number;
  number: string;
  title: string;
  customer: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  sellTotal: number;
};

export type OrderSummary = {
  id: string;
  seq: number;
  number: string;
  title: string;
  customer: string;
  createdAt: string;
  updatedAt: string;
  lineCount: number;
  sellTotal: number;
};

export const FIELDS: Field[] = [
  "article",
  "name",
  "unit",
  "unitPrice",
  "quantity",
  "totalPrice",
  "priceBasis",
];

export function emptyMapping(): ColumnMapping {
  return {
    article: null,
    name: null,
    unit: null,
    unitPrice: null,
    quantity: null,
    totalPrice: null,
    priceBasis: null,
  };
}
