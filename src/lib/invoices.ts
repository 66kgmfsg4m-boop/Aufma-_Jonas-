import { openDatabase } from "@/lib/db";
import { buildInvoiceModel } from "@/lib/quote";
import { getOrder } from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { berlinToday } from "@/lib/format";
import type { InvoiceModel, InvoiceSummary } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summaryFrom(row: Record<string, SqlValue>): InvoiceSummary {
  const snapshot = parseSnapshot(text(row.snapshot));
  return {
    id: text(row.id),
    orderId: text(row.order_id),
    number: text(row.number),
    issuedAt: text(row.issued_at),
    customer: snapshot?.customer ?? "",
    title: snapshot?.title ?? "",
    payable: snapshot?.quote.payable ?? 0,
  };
}

function parseSnapshot(raw: string): InvoiceModel | null {
  try {
    const value = JSON.parse(raw) as InvoiceModel;
    if (!value || typeof value !== "object" || !value.quote) return null;
    return value;
  } catch {
    return null;
  }
}

export function listInvoices(): InvoiceSummary[] {
  return openDatabase()
    .prepare("SELECT * FROM invoices ORDER BY issued_at DESC")
    .all()
    .map(summaryFrom);
}

export function getInvoice(id: string): { summary: InvoiceSummary; model: InvoiceModel } | null {
  const row = openDatabase().prepare("SELECT * FROM invoices WHERE id = ?").get(id);
  if (!row) return null;
  const model = parseSnapshot(text(row.snapshot));
  if (!model) return null;
  return { summary: summaryFrom(row), model };
}

export function issueInvoice(orderId: string): { id: string; model: InvoiceModel } | null {
  const order = getOrder(orderId);
  if (!order) return null;
  const billable =
    order.lines.length > 0 || order.quote.travel !== 0 || order.quote.labor !== 0 || order.quote.smallParts !== 0;
  if (!billable) return null;
  const settings = getSettings();
  const db = openDatabase();
  const count = num(db.prepare("SELECT COUNT(*) AS c FROM invoices WHERE order_id = ?").get(orderId)?.c);
  const number = count === 0 ? order.number : `${order.number}-${count + 1}`;
  const issuedAt = new Date().toISOString();
  const date = order.invoiceDate || berlinToday();
  const model = buildInvoiceModel(order, settings, number, issuedAt, date);
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO invoices (id, order_id, number, issued_at, snapshot) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, orderId, number, issuedAt, JSON.stringify(model));
  return { id, model };
}

export function deleteInvoice(id: string): boolean {
  return openDatabase().prepare("DELETE FROM invoices WHERE id = ?").run(id).changes > 0;
}
