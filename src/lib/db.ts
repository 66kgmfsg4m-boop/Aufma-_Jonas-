import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SqlValue } from "node:sqlite";
import { CATEGORIES } from "@/lib/classify";
import { fold } from "@/lib/parse/text";
import type { DocType, Part, PriceDocument } from "@/lib/types";

const SCHEMA = 2;

const globalDb = globalThis as typeof globalThis & {
  __aufmass?: DatabaseSync;
  __aufmassSchema?: number;
};

function database(): DatabaseSync {
  if (!globalDb.__aufmass) {
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
  }
  if (globalDb.__aufmassSchema !== SCHEMA) {
    ensureOrderTables(globalDb.__aufmass);
    ensureAppSchema(globalDb.__aufmass);
    globalDb.__aufmassSchema = SCHEMA;
  }
  return globalDb.__aufmass;
}

export function openDatabase(): DatabaseSync {
  return database();
}

function ensureOrderTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      seq INTEGER NOT NULL,
      number TEXT NOT NULL,
      title TEXT NOT NULL,
      customer TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_lines (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      part_id TEXT NOT NULL DEFAULT '',
      article_number TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      quantity REAL NOT NULL,
      unit_cost REAL NOT NULL,
      supplier TEXT NOT NULL DEFAULT '',
      source_file TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
  `);
}

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  return new Set(
    db.prepare(`PRAGMA table_info(${table})`).all().map((row) => text(row.name)),
  );
}

function addColumn(db: DatabaseSync, table: string, name: string, definition: string) {
  if (!tableColumns(db, table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

function ensureAppSchema(db: DatabaseSync) {
  addColumn(db, "parts", "category_id", "category_id TEXT");
  for (const [name, definition] of [
    ["client_id", "client_id TEXT NOT NULL DEFAULT ''"],
    ["street", "street TEXT NOT NULL DEFAULT ''"],
    ["zip", "zip TEXT NOT NULL DEFAULT ''"],
    ["city", "city TEXT NOT NULL DEFAULT ''"],
    ["email", "email TEXT NOT NULL DEFAULT ''"],
    ["phone", "phone TEXT NOT NULL DEFAULT ''"],
    ["kilometers", "kilometers REAL NOT NULL DEFAULT 0"],
    ["hours", "hours REAL NOT NULL DEFAULT 0"],
    ["small_parts", "small_parts INTEGER NOT NULL DEFAULT 1"],
    ["discount", "discount REAL NOT NULL DEFAULT 0"],
    ["deduction", "deduction REAL NOT NULL DEFAULT 0"],
    ["service_date", "service_date TEXT NOT NULL DEFAULT ''"],
    ["invoice_date", "invoice_date TEXT NOT NULL DEFAULT ''"],
  ] as const) {
    addColumn(db, "orders", name, definition);
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      hint TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      street TEXT NOT NULL DEFAULT '',
      zip TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      client_id TEXT NOT NULL DEFAULT '',
      order_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL DEFAULT '',
      number TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      snapshot TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
  `);
  const count = db.prepare("SELECT COUNT(*) AS c FROM categories").get();
  if ((num(count?.c) ?? 0) === 0) {
    const insert = db.prepare(
      "INSERT INTO categories (id, label, color, hint, position) VALUES (?, ?, ?, ?, ?)",
    );
    CATEGORIES.forEach((category, index) => {
      insert.run(category.id, category.label, category.color, category.hint, index);
    });
  }
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
    categoryId: text(row.category_id) || null,
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
  const limit = 2000;
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

export const MANUAL_DOCUMENT_ID = "manual-library";

export function createManualPart(input: {
  articleNumber: string;
  name: string;
  unit: string;
  unitPrice: number;
  supplier: string;
  categoryId: string | null;
}): Part {
  const db = database();
  const now = new Date().toISOString();
  const supplier = input.supplier.trim() || "Manuell";
  const existing = db.prepare("SELECT id FROM documents WHERE id = ?").get(MANUAL_DOCUMENT_ID);
  if (!existing) {
    db.prepare(
      `INSERT INTO documents (id, filename, doc_type, supplier, uploaded_at, item_count)
       VALUES (?, 'Manuelle Eingabe', 'katalog', 'Manuell', ?, 0)`,
    ).run(MANUAL_DOCUMENT_ID, now);
  }
  const id = crypto.randomUUID();
  const articleNumber = input.articleNumber.trim();
  const name = input.name.trim();
  db.prepare(
    `INSERT INTO parts (
      id, document_id, article_number, name, unit, unit_price, quantity, total_price,
      price_basis, currency, supplier, doc_type, source_file, imported_at, search_text, category_id
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 1, 'EUR', ?, 'katalog', 'Manuelle Eingabe', ?, ?, ?)`,
  ).run(
    id,
    MANUAL_DOCUMENT_ID,
    articleNumber,
    name,
    input.unit.trim(),
    input.unitPrice,
    supplier,
    now,
    fold([articleNumber, name, supplier, input.unit, "Manuelle Eingabe"].join(" ")),
    input.categoryId,
  );
  db.prepare(
    `UPDATE documents
     SET item_count = (SELECT COUNT(*) FROM parts WHERE document_id = ?), uploaded_at = ?
     WHERE id = ?`,
  ).run(MANUAL_DOCUMENT_ID, now, MANUAL_DOCUMENT_ID);
  return getPart(id)!;
}

export function assignCategories(ids: string[], categoryId: string): number {
  const db = database();
  const update = db.prepare("UPDATE parts SET category_id = ? WHERE id = ?");
  let changed = 0;
  for (const id of ids) {
    changed += update.run(categoryId, id).changes;
  }
  return changed;
}
