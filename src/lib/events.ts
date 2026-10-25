import { openDatabase } from "@/lib/db";
import type { CalendarEvent } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function mapEvent(row: Record<string, SqlValue>): CalendarEvent {
  return {
    id: text(row.id),
    date: text(row.date),
    title: text(row.title),
    clientId: text(row.client_id),
    orderId: text(row.order_id),
    clientName: text(row.client_name),
    notes: text(row.notes),
    createdAt: text(row.created_at),
  };
}

const SELECT = `
  SELECT events.*, COALESCE(clients.name, '') AS client_name
  FROM events
  LEFT JOIN clients ON clients.id = events.client_id
`;

export function listEvents(from: string, to: string): CalendarEvent[] {
  return openDatabase()
    .prepare(`${SELECT} WHERE events.date >= ? AND events.date <= ? ORDER BY events.date ASC, events.created_at ASC`)
    .all(from, to)
    .map(mapEvent);
}

export function createEvent(input: {
  date: string;
  title: string;
  clientId: string;
  orderId: string;
  notes: string;
}): CalendarEvent | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !input.title.trim()) return null;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  openDatabase()
    .prepare(
      `INSERT INTO events (id, date, title, client_id, order_id, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.date, input.title.trim(), input.clientId, input.orderId, input.notes.trim(), now);
  const row = openDatabase().prepare(`${SELECT} WHERE events.id = ?`).get(id);
  return row ? mapEvent(row) : null;
}

export function updateEvent(
  id: string,
  input: { date: string; title: string; clientId: string; orderId: string; notes: string },
): CalendarEvent | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !input.title.trim()) return null;
  const result = openDatabase()
    .prepare(
      `UPDATE events SET date = ?, title = ?, client_id = ?, order_id = ?, notes = ? WHERE id = ?`,
    )
    .run(input.date, input.title.trim(), input.clientId, input.orderId, input.notes.trim(), id);
  if (result.changes === 0) return null;
  const row = openDatabase().prepare(`${SELECT} WHERE events.id = ?`).get(id);
  return row ? mapEvent(row) : null;
}

export function deleteEvent(id: string): boolean {
  return openDatabase().prepare("DELETE FROM events WHERE id = ?").run(id).changes > 0;
}
