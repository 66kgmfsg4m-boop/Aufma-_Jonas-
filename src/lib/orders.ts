import { upsertClient } from "@/lib/clients";
import { getPart, openDatabase } from "@/lib/db";
import { lineTotal, sellPrice } from "@/lib/pricing";
import { buildQuote } from "@/lib/quote";
import { getSettings } from "@/lib/settings";
import type { AppSettings, JobOrder, OrderLine, OrderSummary } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function num(value: SqlValue | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return Number(value);
  return null;
}

function berlinYear(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date(iso));
}

function mapLine(row: Record<string, SqlValue>, markupPercent: number): OrderLine {
  const unitCost = num(row.unit_cost) ?? 0;
  const quantity = num(row.quantity) ?? 0;
  const unitSell = sellPrice(unitCost, markupPercent);
  return {
    id: text(row.id),
    orderId: text(row.order_id),
    partId: text(row.part_id),
    articleNumber: text(row.article_number),
    name: text(row.name),
    unit: text(row.unit),
    quantity,
    unitCost,
    unitSell,
    lineTotal: lineTotal(unitSell, quantity),
    supplier: text(row.supplier),
    sourceFile: text(row.source_file),
    position: num(row.position) ?? 0,
  };
}

function linesFor(orderId: string, markupPercent: number): OrderLine[] {
  return openDatabase()
    .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY position ASC, rowid ASC")
    .all(orderId)
    .map((row) => mapLine(row, markupPercent));
}

function sellTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
}

function bounded(value: number, max = 10_000_000): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, Math.round(value * 100) / 100);
}

function quoteFor(row: Record<string, SqlValue>, lines: OrderLine[], settings: AppSettings) {
  return buildQuote({
    material: sellTotal(lines),
    smallPartsOn: (num(row.small_parts) ?? 1) !== 0,
    kilometers: num(row.kilometers) ?? 0,
    hours: num(row.hours) ?? 0,
    discount: num(row.discount) ?? 0,
    deduction: num(row.deduction) ?? 0,
    markupPercent: settings.markupPercent,
    smallPartsPercent: settings.smallPartsPercent,
    travelEuroPerKm: settings.travelEuroPerKm,
    hourlyRate: settings.hourlyRate,
    vatPercent: settings.vatPercent,
    skontoPercent: settings.skontoPercent,
    skontoDays: settings.skontoDays,
    paymentDays: settings.paymentDays,
  });
}

function mapOrder(row: Record<string, SqlValue>, lines: OrderLine[], settings: AppSettings): JobOrder {
  const quote = quoteFor(row, lines, settings);
  return {
    id: text(row.id),
    seq: num(row.seq) ?? 0,
    number: text(row.number),
    title: text(row.title),
    customer: text(row.customer),
    clientId: text(row.client_id),
    street: text(row.street),
    zip: text(row.zip),
    city: text(row.city),
    email: text(row.email),
    phone: text(row.phone),
    kilometers: num(row.kilometers) ?? 0,
    hours: num(row.hours) ?? 0,
    smallParts: (num(row.small_parts) ?? 1) !== 0,
    discount: num(row.discount) ?? 0,
    deduction: num(row.deduction) ?? 0,
    serviceDate: text(row.service_date),
    invoiceDate: text(row.invoice_date),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    lines,
    sellTotal: quote.material,
    quote,
  };
}

export function listOrders(): OrderSummary[] {
  const db = openDatabase();
  const settings = getSettings();
  const rows = db.prepare("SELECT * FROM orders ORDER BY updated_at DESC").all();
  return rows.map((row) => {
    const lines = linesFor(text(row.id), settings.markupPercent);
    const quote = quoteFor(row, lines, settings);
    return {
      id: text(row.id),
      seq: num(row.seq) ?? 0,
      number: text(row.number),
      title: text(row.title),
      customer: text(row.customer),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      lineCount: lines.length,
      sellTotal: quote.material,
      payable: quote.payable,
    };
  });
}

export function getOrder(id: string): JobOrder | null {
  const settings = getSettings();
  const row = openDatabase().prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) return null;
  return mapOrder(row, linesFor(id, settings.markupPercent), settings);
}

export function createOrder(input: { title: string; customer: string }): JobOrder {
  const db = openDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const seqRow = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM orders").get();
  const seq = (num(seqRow?.seq) ?? 0) + 1;
  const number = `RE-${berlinYear(now)}-${String(seq).padStart(3, "0")}`;
  const title = input.title.trim() || "Auftrag";
  const customer = input.customer.trim();
  const client = customer
    ? upsertClient({ name: customer, street: "", zip: "", city: "", email: "", phone: "" })
    : null;
  db.prepare(
    `INSERT INTO orders (id, seq, number, title, customer, client_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, seq, number, title, customer, client?.id ?? "", now, now);
  return getOrder(id)!;
}

export type OrderHead = {
  title: string;
  customer: string;
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
};

function dateOrEmpty(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function updateOrder(id: string, input: OrderHead): JobOrder | null {
  const current = getOrder(id);
  if (!current) return null;
  const title = input.title.trim();
  if (!title) return null;
  const customer = input.customer.trim();
  const street = input.street.trim();
  const zip = input.zip.trim();
  const city = input.city.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const client = customer
    ? upsertClient({ name: customer, street, zip, city, email, phone })
    : null;
  openDatabase()
    .prepare(
      `UPDATE orders SET
        title = ?, customer = ?, client_id = ?, street = ?, zip = ?, city = ?, email = ?, phone = ?,
        kilometers = ?, hours = ?, small_parts = ?, discount = ?, deduction = ?,
        service_date = ?, invoice_date = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      title,
      customer,
      client?.id ?? "",
      street,
      zip,
      city,
      email,
      phone,
      bounded(input.kilometers),
      bounded(input.hours),
      input.smallParts ? 1 : 0,
      bounded(input.discount),
      bounded(input.deduction),
      dateOrEmpty(input.serviceDate),
      dateOrEmpty(input.invoiceDate),
      new Date().toISOString(),
      id,
    );
  return getOrder(id);
}

export function deleteOrder(id: string): boolean {
  const result = openDatabase().prepare("DELETE FROM orders WHERE id = ?").run(id);
  return result.changes > 0;
}

export function addOrderLine(orderId: string, partId: string, quantity: number): JobOrder | null {
  const order = getOrder(orderId);
  const part = getPart(partId);
  if (!order || !part || part.unitPrice == null || part.unitPrice <= 0 || quantity <= 0) return null;
  const db = openDatabase();
  const existing = db
    .prepare("SELECT id, quantity FROM order_lines WHERE order_id = ? AND part_id = ?")
    .get(orderId, partId);
  if (existing) {
    const next = (num(existing.quantity) ?? 0) + quantity;
    db.prepare("UPDATE order_lines SET quantity = ? WHERE id = ?").run(next, text(existing.id));
  } else {
    const position = order.lines.length + 1;
    db.prepare(
      `INSERT INTO order_lines (
        id, order_id, part_id, article_number, name, unit, quantity, unit_cost, supplier, source_file, position
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      crypto.randomUUID(),
      orderId,
      part.id,
      part.articleNumber,
      part.name || part.articleNumber,
      part.unit,
      quantity,
      part.unitPrice,
      part.supplier,
      part.sourceFile,
      position,
    );
  }
  db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
  return getOrder(orderId);
}

export function updateOrderLine(orderId: string, lineId: string, quantity: number): JobOrder | null {
  if (quantity <= 0) return null;
  const db = openDatabase();
  const result = db
    .prepare("UPDATE order_lines SET quantity = ? WHERE id = ? AND order_id = ?")
    .run(quantity, lineId, orderId);
  if (result.changes === 0) return null;
  db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
  return getOrder(orderId);
}

export function deleteOrderLine(orderId: string, lineId: string): JobOrder | null {
  const db = openDatabase();
  const result = db.prepare("DELETE FROM order_lines WHERE id = ? AND order_id = ?").run(lineId, orderId);
  if (result.changes === 0) return null;
  db.prepare("UPDATE orders SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), orderId);
  return getOrder(orderId);
}
