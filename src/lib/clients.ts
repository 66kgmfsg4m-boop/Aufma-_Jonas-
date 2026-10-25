import { openDatabase } from "@/lib/db";
import type { Client } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function mapClient(row: Record<string, SqlValue>): Client {
  return {
    id: text(row.id),
    name: text(row.name),
    street: text(row.street),
    zip: text(row.zip),
    city: text(row.city),
    email: text(row.email),
    phone: text(row.phone),
    notes: text(row.notes),
    updatedAt: text(row.updated_at),
  };
}

export function listClients(): Client[] {
  return openDatabase()
    .prepare("SELECT * FROM clients ORDER BY name COLLATE NOCASE")
    .all()
    .map(mapClient);
}

export function getClient(id: string): Client | null {
  const row = openDatabase().prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return row ? mapClient(row) : null;
}

export type ClientInput = {
  name: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  notes?: string;
};

export function upsertClient(input: ClientInput): Client | null {
  const name = input.name.trim();
  if (!name) return null;
  const db = openDatabase();
  const existing = db.prepare("SELECT * FROM clients WHERE lower(name) = lower(?)").get(name);
  const now = new Date().toISOString();
  if (existing) {
    db.prepare(
      `UPDATE clients
       SET name = ?, street = ?, zip = ?, city = ?, email = ?, phone = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      name,
      input.street.trim(),
      input.zip.trim(),
      input.city.trim(),
      input.email.trim(),
      input.phone.trim(),
      now,
      text(existing.id),
    );
    return getClient(text(existing.id));
  }
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO clients (id, name, street, zip, city, email, phone, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    name,
    input.street.trim(),
    input.zip.trim(),
    input.city.trim(),
    input.email.trim(),
    input.phone.trim(),
    (input.notes ?? "").trim(),
    now,
  );
  return getClient(id);
}

export function updateClient(id: string, input: ClientInput): Client | null {
  const current = getClient(id);
  if (!current || !input.name.trim()) return null;
  openDatabase()
    .prepare(
      `UPDATE clients
       SET name = ?, street = ?, zip = ?, city = ?, email = ?, phone = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      input.name.trim(),
      input.street.trim(),
      input.zip.trim(),
      input.city.trim(),
      input.email.trim(),
      input.phone.trim(),
      (input.notes ?? "").trim(),
      new Date().toISOString(),
      id,
    );
  return getClient(id);
}

export function deleteClient(id: string): boolean {
  const db = openDatabase();
  const result = db.prepare("DELETE FROM clients WHERE id = ?").run(id);
  if (result.changes === 0) return false;
  db.prepare("UPDATE orders SET client_id = '' WHERE client_id = ?").run(id);
  db.prepare("UPDATE events SET client_id = '' WHERE client_id = ?").run(id);
  return true;
}
