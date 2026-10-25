import type { AppSettings, InvoiceExtra, InvoiceModel, JobOrder, Quote } from "@/lib/types";

export const DEFAULT_SETTINGS: AppSettings = {
  markupPercent: 20,
  smallPartsPercent: 5,
  travelEuroPerKm: 0.7,
  hourlyRate: 55,
  vatPercent: 19,
  skontoPercent: 3,
  skontoDays: 14,
  paymentDays: 30,
  companyName: "",
  companyStreet: "",
  companyZip: "",
  companyCity: "",
  companyPhone: "",
  companyEmail: "",
  taxNumber: "",
  vatId: "",
  bank: "",
  footer: "",
  templateName: "",
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildQuote(input: {
  material: number;
  smallPartsOn: boolean;
  kilometers: number;
  hours: number;
  discount: number;
  deduction: number;
  markupPercent: number;
  smallPartsPercent: number;
  travelEuroPerKm: number;
  hourlyRate: number;
  vatPercent: number;
  skontoPercent: number;
  skontoDays: number;
  paymentDays: number;
}): Quote {
  const material = roundMoney(input.material);
  const smallParts = input.smallPartsOn
    ? roundMoney((material * input.smallPartsPercent) / 100)
    : 0;
  const kilometers = input.kilometers > 0 ? input.kilometers : 0;
  const hours = input.hours > 0 ? input.hours : 0;
  const travel = roundMoney(kilometers * input.travelEuroPerKm);
  const labor = roundMoney(hours * input.hourlyRate);
  const discount = roundMoney(input.discount > 0 ? input.discount : 0);
  const net = roundMoney(material + smallParts + travel + labor - discount);
  const vat = roundMoney((net * input.vatPercent) / 100);
  const gross = roundMoney(net + vat);
  const deductionNet = roundMoney(input.deduction > 0 ? input.deduction : 0);
  const deductionVat = roundMoney((deductionNet * input.vatPercent) / 100);
  const deductionGross = roundMoney(deductionNet + deductionVat);
  const payable = roundMoney(gross - deductionGross);
  return {
    material,
    smallParts,
    travel,
    labor,
    discount,
    net,
    vat,
    gross,
    deductionNet,
    deductionVat,
    deductionGross,
    payable,
    markupPercent: input.markupPercent,
    smallPartsPercent: input.smallPartsPercent,
    travelEuroPerKm: input.travelEuroPerKm,
    hourlyRate: input.hourlyRate,
    vatPercent: input.vatPercent,
    skontoPercent: input.skontoPercent,
    skontoDays: input.skontoDays,
    paymentDays: input.paymentDays,
    kilometers,
    hours,
    smallPartsOn: input.smallPartsOn,
  };
}

export function invoiceExtras(quote: Quote): InvoiceExtra[] {
  const extras: InvoiceExtra[] = [];
  if (quote.smallPartsOn && quote.smallParts !== 0) {
    extras.push({
      label: "Kleinteilepauschale",
      detail: `${formatPlain(quote.smallPartsPercent)} % vom Material`,
      quantity: 1,
      unit: "psch",
      unitPrice: quote.smallParts,
      total: quote.smallParts,
    });
  }
  if (quote.kilometers > 0) {
    extras.push({
      label: "Anfahrtskosten",
      detail: `${formatPlain(quote.kilometers)} km`,
      quantity: quote.kilometers,
      unit: "km",
      unitPrice: quote.travelEuroPerKm,
      total: quote.travel,
    });
  }
  if (quote.hours > 0) {
    extras.push({
      label: "Arbeitszeit",
      detail: `${formatPlain(quote.hours)} Stunden`,
      quantity: quote.hours,
      unit: "Std",
      unitPrice: quote.hourlyRate,
      total: quote.labor,
    });
  }
  return extras;
}

function formatPlain(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

export function buildInvoiceModel(
  order: JobOrder,
  settings: AppSettings,
  number: string,
  issuedAt: string,
  date: string,
): InvoiceModel {
  return {
    number,
    issuedAt,
    date,
    title: order.title,
    customer: order.customer,
    street: order.street,
    zip: order.zip,
    city: order.city,
    email: order.email,
    phone: order.phone,
    serviceDate: order.serviceDate,
    lines: order.lines.map((line, index) => ({
      position: index + 1,
      name: line.name,
      articleNumber: line.articleNumber,
      unit: line.unit,
      quantity: line.quantity,
      unitSell: line.unitSell,
      lineTotal: line.lineTotal,
    })),
    extras: invoiceExtras(order.quote),
    quote: order.quote,
    companyName: settings.companyName,
    companyStreet: settings.companyStreet,
    companyZip: settings.companyZip,
    companyCity: settings.companyCity,
    companyPhone: settings.companyPhone,
    companyEmail: settings.companyEmail,
    taxNumber: settings.taxNumber,
    vatId: settings.vatId,
    bank: settings.bank,
    footer: settings.footer,
  };
}
