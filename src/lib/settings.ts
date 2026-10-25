import path from "node:path";
import { openDatabase } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/quote";
import type { AppSettings } from "@/lib/types";
import type { SqlValue } from "node:sqlite";

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

function text(value: SqlValue | undefined): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function readNumber(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || raw === "") return fallback;
  return clamp(Number(raw), min, max, fallback);
}

export function getSettings(): AppSettings {
  const rows = openDatabase().prepare("SELECT key, value FROM settings").all();
  const map = new Map(rows.map((row) => [text(row.key), text(row.value)]));
  return {
    markupPercent: readNumber(map.get("markupPercent"), DEFAULT_SETTINGS.markupPercent, 0, 500),
    smallPartsPercent: readNumber(map.get("smallPartsPercent"), DEFAULT_SETTINGS.smallPartsPercent, 0, 100),
    travelEuroPerKm: readNumber(map.get("travelEuroPerKm"), DEFAULT_SETTINGS.travelEuroPerKm, 0, 100),
    hourlyRate: readNumber(map.get("hourlyRate"), DEFAULT_SETTINGS.hourlyRate, 0, 10000),
    vatPercent: readNumber(map.get("vatPercent"), DEFAULT_SETTINGS.vatPercent, 0, 100),
    skontoPercent: readNumber(map.get("skontoPercent"), DEFAULT_SETTINGS.skontoPercent, 0, 100),
    skontoDays: Math.round(readNumber(map.get("skontoDays"), DEFAULT_SETTINGS.skontoDays, 0, 365)),
    paymentDays: Math.round(readNumber(map.get("paymentDays"), DEFAULT_SETTINGS.paymentDays, 0, 365)),
    companyName: map.get("companyName") ?? "",
    companyStreet: map.get("companyStreet") ?? "",
    companyZip: map.get("companyZip") ?? "",
    companyCity: map.get("companyCity") ?? "",
    companyPhone: map.get("companyPhone") ?? "",
    companyEmail: map.get("companyEmail") ?? "",
    taxNumber: map.get("taxNumber") ?? "",
    vatId: map.get("vatId") ?? "",
    bank: map.get("bank") ?? "",
    footer: map.get("footer") ?? "",
    templateName: map.get("templateName") ?? "",
  };
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const next: AppSettings = { ...current };
  for (const key of KEYS) {
    if (patch[key] === undefined) continue;
    const value = patch[key];
    if (typeof current[key] === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      const limits: Record<string, [number, number]> = {
        markupPercent: [0, 500],
        smallPartsPercent: [0, 100],
        travelEuroPerKm: [0, 100],
        hourlyRate: [0, 10000],
        vatPercent: [0, 100],
        skontoPercent: [0, 100],
        skontoDays: [0, 365],
        paymentDays: [0, 365],
      };
      const [min, max] = limits[key] ?? [0, 1_000_000];
      (next[key] as number) = clamp(numeric, min, max, current[key] as number);
      if (key === "skontoDays" || key === "paymentDays") next[key] = Math.round(next[key] as number);
    } else if (typeof value === "string") {
      (next[key] as string) =
        key === "footer" ? value.trim().slice(0, 800) : value.replace(/\s+/g, " ").trim().slice(0, 400);
    }
  }
  const db = openDatabase();
  const stmt = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  for (const key of KEYS) stmt.run(key, String(next[key]));
  return next;
}

export function templateFile(): string {
  return path.join(process.cwd(), "data", "templates", "vorlage.pdf");
}
