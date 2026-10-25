import { getPart, openDatabase } from "@/lib/db";
import { lineTotal, sellPrice } from "@/lib/pricing";
import type { JobOrder, OrderLine, OrderSummary } from "@/lib/types";
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

function mapLine(row: Record<string, SqlValue>): OrderLine {
  const unitCost = num(row.unit_cost) ?? 0;
  const quantity = num(row.quantity) ?? 0;
  const unitSell = sellPrice(unitCost);
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

function linesFor(orderId: string): OrderLine[] {
  return openDatabase()
    .prepare("SELECT * FROM order_lines WHERE order_id = ? ORDER BY position ASC, rowid ASC")
    .all(orderId)
    .map(mapLine);
}

function sellTotal(lines: OrderLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.lineTotal, 0) * 100) / 100;
}

function mapOrder(row: Record<string, SqlValue>, lines: OrderLine[]): JobOrder {
  return {
    id: text(row.id),
    seq: num(row.seq) ?? 0,
    number: text(row.number),
    title: text(row.title),
    customer: text(row.customer),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    lines,
    sellTotal: sellTotal(lines),
  };
}

export function listOrders(): OrderSummary[] {
  const db = openDatabase();
  const rows = db.prepare("SELECT * FROM orders ORDER BY updated_at DESC").all();
  return rows.map((row) => {
    const lines = linesFor(text(row.id));
    return {
      id: text(row.id),
      seq: num(row.seq) ?? 0,
      number: text(row.number),
      title: text(row.title),
      customer: text(row.customer),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      lineCount: lines.length,
      sellTotal: sellTotal(lines),
    };
  });
}

export function getOrder(id: string): JobOrder | null {
  const row = openDatabase().prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!row) return null;
  return mapOrder(row, linesFor(id));
}

export function createOrder(input: { title: string; customer: string }): JobOrder {
  const db = openDatabase();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const seqRow = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM orders").get();
  const seq = (num(seqRow?.seq) ?? 0) + 1;
  const number = `RE-${berlinYear(now)}-${String(seq).padStart(3, "0")}`;
  const title = input.title.trim() || "Auftrag";
  db.prepare(
    `INSERT INTO orders (id, seq, number, title, customer, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, seq, number, title, input.customer.trim(), now, now);
  return getOrder(id)!;
}

export function updateOrder(id: string, input: { title: string; customer: string }): JobOrder | null {
  const current = getOrder(id);
  if (!current) return null;
  const title = input.title.trim();
  if (!title) return null;
  openDatabase()
    .prepare("UPDATE orders SET title = ?, customer = ?, updated_at = ? WHERE id = ?")
    .run(title, input.customer.trim(), new Date().toISOString(), id);
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
