import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SqlValue } from "node:sqlite";
import { fold } from "@/lib/parse/text";
import type { DocType, Part, PriceDocument } from "@/lib/types";

const globalDb = globalThis as typeof globalThis & { __aufmass?: DatabaseSync };

function database(): DatabaseSync {
  if (globalDb.__aufmass) return globalDb.__aufmass;
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "aufmass.db"), {
    enableForeignKeyConstraints: true,
  });
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      supplier TEXT NOT NULL,
      uploaded_at TEXT NOT NULL,
      item_count INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      article_number TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      unit_price REAL,
      quantity REAL,
      total_price REAL,
      price_basis REAL NOT NULL DEFAULT 1,
      currency TEXT NOT NULL DEFAULT 'EUR',
      supplier TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      source_file TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      search_text TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_parts_document ON parts(document_id);
    CREATE INDEX IF NOT EXISTS idx_parts_supplier ON parts(supplier);
  `);
  globalDb.__aufmass = db;
  return db;
}

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

function mapPart(row: Record<string, SqlValue>): Part {
  return {
    id: text(row.id),
    documentId: text(row.document_id),
    articleNumber: text(row.article_number),
    name: text(row.name),
    unit: text(row.unit),
    unitPrice: num(row.unit_price),
    quantity: num(row.quantity),
    totalPrice: num(row.total_price),
    priceBasis: num(row.price_basis) ?? 1,
    currency: text(row.currency) || "EUR",
    supplier: text(row.supplier),
    docType: text(row.doc_type) === "rechnung" ? "rechnung" : "katalog",
    sourceFile: text(row.source_file),
    importedAt: text(row.imported_at),
  };
}

function mapDocument(row: Record<string, SqlValue>): PriceDocument {
  return {
    id: text(row.id),
    filename: text(row.filename),
    docType: text(row.doc_type) === "rechnung" ? "rechnung" : "katalog",
    supplier: text(row.supplier),
    uploadedAt: text(row.uploaded_at),
    itemCount: num(row.item_count) ?? 0,
  };
}

export type IncomingPart = {
  articleNumber: string;
  name: string;
  unit: string;
  unitPrice: number | null;
  quantity: number | null;
  totalPrice: number | null;
  priceBasis: number;
};

function searchBlob(part: IncomingPart, supplier: string, filename: string): string {
  return fold([part.articleNumber, part.name, supplier, part.unit, filename].join(" "));
}

export function importDocument(input: {
  id?: string;
  filename: string;
  supplier: string;
  docType: DocType;
  items: IncomingPart[];
  uploadedAt?: string;
}): PriceDocument {
  const db = database();
  const id = input.id ?? crypto.randomUUID();
  const now = input.uploadedAt ?? new Date().toISOString();
  const items = input.items.filter((item) => (item.name || item.articleNumber) && item.unitPrice != null);
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    db.prepare(
      `INSERT INTO documents (id, filename, doc_type, supplier, uploaded_at, item_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.filename, input.docType, input.supplier, now, items.length);
    const insert = db.prepare(
      `INSERT INTO parts (
        id, document_id, article_number, name, unit, unit_price, quantity, total_price,
        price_basis, currency, supplier, doc_type, source_file, imported_at, search_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?)`,
    );
    for (const item of items) {
      insert.run(
        crypto.randomUUID(),
        id,
        item.articleNumber,
        item.name,
        item.unit,
        item.unitPrice,
        item.quantity,
        item.totalPrice,
        item.priceBasis > 0 ? item.priceBasis : 1,
        input.supplier,
        input.docType,
        input.filename,
        now,
        searchBlob(item, input.supplier, input.filename),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return {
    id,
    filename: input.filename,
    docType: input.docType,
    supplier: input.supplier,
    uploadedAt: now,
    itemCount: items.length,
  };
}

export type SearchQuery = {
  q: string;
  unit: string;
  supplier: string;
  docType: string;
};

export function searchParts(query: SearchQuery): {
  items: Part[];
  total: number;
  mode: "recent" | "search";
} {
  const db = database();
  const q = query.q.trim();
  const folded = fold(q).replace(/[\\%_]/g, (char) => `\\${char}`);
  const unit = query.unit.trim();
  const supplier = query.supplier.trim();
  const docType = query.docType === "rechnung" || query.docType === "katalog" ? query.docType : "";
  const where = `
    WHERE (? = '' OR search_text LIKE ? ESCAPE '\\')
      AND (
        ? = ''
        OR (? != 'other' AND unit = ?)
        OR (? = 'other' AND unit NOT IN ('Stk', 'm', 'm²', 'm³', 'kg') AND unit != '')
      )
      AND (? = '' OR supplier = ?)
      AND (? = '' OR doc_type = ?)
  `;
  const params: SqlValue[] = [
    q ? "1" : "",
    q ? `%${folded}%` : "",
    unit,
    unit,
    unit,
    unit,
    supplier,
    supplier,
    docType,
    docType,
  ];
  const totalRow = db.prepare(`SELECT COUNT(*) AS c FROM parts ${where}`).get(...params);
  const total = num(totalRow?.c) ?? 0;
  const limit = q ? 250 : 60;
  const rows = db
    .prepare(
      `SELECT * FROM parts ${where}
       ORDER BY
         CASE WHEN ? != '' AND lower(article_number) = lower(?) THEN 0 ELSE 1 END,
         CASE WHEN unit_price IS NULL THEN 1 ELSE 0 END,
         unit_price ASC,
         imported_at DESC
       LIMIT ${limit}`,
    )
    .all(...params, q ? "1" : "", q);
  return {
    items: rows.map(mapPart),
    total,
    mode: q ? "search" : "recent",
  };
}

export function listDocuments(): PriceDocument[] {
  return database()
    .prepare("SELECT * FROM documents ORDER BY uploaded_at DESC")
    .all()
    .map(mapDocument);
}

export function deleteDocument(id: string): boolean {
  const result = database().prepare("DELETE FROM documents WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getPart(id: string): Part | null {
  const row = database().prepare("SELECT * FROM parts WHERE id = ?").get(id);
  return row ? mapPart(row) : null;
}

export function relatedParts(id: string): Part[] {
  const part = getPart(id);
  if (!part?.articleNumber) return [];
  return database()
    .prepare(
      `SELECT * FROM parts
       WHERE lower(article_number) = lower(?) AND id != ?
       ORDER BY unit_price ASC, imported_at DESC`,
    )
    .all(part.articleNumber, id)
    .map(mapPart);
}

export function updatePart(
  id: string,
  input: { articleNumber: string; name: string; unit: string; unitPrice: number | null },
): Part | null {
  const current = getPart(id);
  if (!current) return null;
  const articleNumber = input.articleNumber.trim().slice(0, 80);
  const name = input.name.trim().slice(0, 300);
  const unit = input.unit.trim().slice(0, 24);
  if (!articleNumber && !name) return null;
  database()
    .prepare(
      `UPDATE parts
       SET article_number = ?, name = ?, unit = ?, unit_price = ?, search_text = ?
       WHERE id = ?`,
    )
    .run(
      articleNumber,
      name,
      unit,
      input.unitPrice,
      fold([articleNumber, name, current.supplier, unit, current.sourceFile].join(" ")),
      id,
    );
  return getPart(id);
}

export function deletePart(id: string): boolean {
  const db = database();
  const current = getPart(id);
  if (!current) return false;
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM parts WHERE id = ?").run(id);
    const remaining = db
      .prepare("SELECT COUNT(*) AS c FROM parts WHERE document_id = ?")
      .get(current.documentId);
    const count = num(remaining?.c) ?? 0;
    if (count === 0) db.prepare("DELETE FROM documents WHERE id = ?").run(current.documentId);
    else db.prepare("UPDATE documents SET item_count = ? WHERE id = ?").run(count, current.documentId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return true;
}

export function libraryStats(): {
  partCount: number;
  supplierCount: number;
  documentCount: number;
  latestImport: string | null;
  suppliers: { name: string; count: number }[];
} {
  const db = database();
  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM parts) AS parts,
         (SELECT COUNT(DISTINCT supplier) FROM parts) AS suppliers,
         (SELECT COUNT(*) FROM documents) AS documents,
         (SELECT MAX(uploaded_at) FROM documents) AS latest`,
    )
    .get();
  const suppliers = db
    .prepare(
      `SELECT supplier AS name, COUNT(*) AS count
       FROM parts GROUP BY supplier ORDER BY supplier COLLATE NOCASE`,
    )
    .all();
  return {
    partCount: num(counts?.parts) ?? 0,
    supplierCount: num(counts?.suppliers) ?? 0,
    documentCount: num(counts?.documents) ?? 0,
    latestImport: counts?.latest == null ? null : text(counts.latest),
    suppliers: suppliers.map((row) => ({ name: text(row.name), count: num(row.count) ?? 0 })),
  };
}
