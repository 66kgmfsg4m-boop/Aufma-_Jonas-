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
  categoryId: string | null;
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

export type Quote = {
  material: number;
  smallParts: number;
  travel: number;
  labor: number;
  discount: number;
  net: number;
  vat: number;
  gross: number;
  deductionNet: number;
  deductionVat: number;
  deductionGross: number;
  payable: number;
  markupPercent: number;
  smallPartsPercent: number;
  travelEuroPerKm: number;
  hourlyRate: number;
  vatPercent: number;
  skontoPercent: number;
  skontoDays: number;
  paymentDays: number;
  kilometers: number;
  hours: number;
  smallPartsOn: boolean;
};

export type JobOrder = {
  id: string;
  seq: number;
  number: string;
  title: string;
  customer: string;
  clientId: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  kilometers: number;
  hours: number;
  smallParts: boolean;
  discount: number;
  deduction: number;
  serviceDate: string;
  invoiceDate: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
  sellTotal: number;
  quote: Quote;
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
  payable: number;
};

export type AppSettings = {
  markupPercent: number;
  smallPartsPercent: number;
  travelEuroPerKm: number;
  hourlyRate: number;
  vatPercent: number;
  skontoPercent: number;
  skontoDays: number;
  paymentDays: number;
  companyName: string;
  companyStreet: string;
  companyZip: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  taxNumber: string;
  vatId: string;
  bank: string;
  footer: string;
  templateName: string;
};

export type Client = {
  id: string;
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  notes: string;
  updatedAt: string;
};

export type StoredCategory = {
  id: string;
  label: string;
  hint: string;
  color: string;
  position: number;
};

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  clientId: string;
  orderId: string;
  clientName: string;
  notes: string;
  createdAt: string;
};

export type InvoiceExtra = {
  label: string;
  detail: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
};

export type InvoiceModel = {
  number: string;
  issuedAt: string;
  date: string;
  title: string;
  customer: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  serviceDate: string;
  lines: {
    position: number;
    name: string;
    articleNumber: string;
    unit: string;
    quantity: number;
    unitSell: number;
    lineTotal: number;
  }[];
  extras: InvoiceExtra[];
  quote: Quote;
  companyName: string;
  companyStreet: string;
  companyZip: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  taxNumber: string;
  vatId: string;
  bank: string;
  footer: string;
};

export type InvoiceSummary = {
  id: string;
  orderId: string;
  number: string;
  issuedAt: string;
  customer: string;
  title: string;
  payable: number;
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
