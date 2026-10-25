"use client";

import { notifyLibraryChanged, requestJson } from "@/components/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import {
  FIELDS,
  type ColumnMapping,
  type DocType,
  type ExtractedItem,
  type Field,
  type LibraryStats,
  type ParseResult,
} from "@/lib/types";
import { FileSpreadsheetIcon, Loader2Icon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const fieldLabels: Record<Field, string> = {
  article: "Artikelnummer",
  name: "Bezeichnung",
  unit: "Einheit",
  unitPrice: "Einzelpreis",
  quantity: "Menge",
  totalPrice: "Gesamtpreis",
  priceBasis: "Preisbasis",
};

type Draft = ExtractedItem & { selected: boolean; priceText: string };

export function ImportView() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const remapToken = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [remapping, setRemapping] = useState(false);
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [supplier, setSupplier] = useState("");
  const [docType, setDocType] = useState<DocType>("katalog");
  const [suppliers, setSuppliers] = useState<string[]>([]);

  useEffect(() => {
    void requestJson<LibraryStats>("/api/stats")
      .then((stats) => setSuppliers(stats.suppliers.map((entry) => entry.name)))
      .catch(() => setSuppliers([]));
  }, []);

  const selectedCount = drafts.filter((draft) => draft.selected && draft.unitPrice != null).length;
  const pricedCount = drafts.filter((draft) => draft.unitPrice != null).length;

  async function loadExamples() {
    setSampling(true);
    try {
      const result = await requestJson<{ parts: number }>("/api/sample", { method: "POST" });
      notifyLibraryChanged();
      toast.success(`${result.parts} Beispielpreise geladen`);
      router.push("/");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Beispielrechnungen fehlgeschlagen");
    } finally {
      setSampling(false);
    }
  }

  async function parseFile(file: File) {
    setError("");
    setReading(true);
    setParsed(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const result = await requestJson<ParseResult>("/api/parse", { method: "POST", body });
      setParsed(result);
      setDrafts(toDrafts(result.items));
      setSupplier(result.suggestedSupplier);
      setDocType(/rechnung|invoice|beleg/i.test(result.filename) ? "rechnung" : "katalog");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setReading(false);
      setDragging(false);
    }
  }

  async function updateMapping(field: Field, value: string) {
    if (!parsed) return;
    const next: ColumnMapping = {
      ...parsed.mapping,
      [field]: value === "none" ? null : Number(value),
    };
    const token = ++remapToken.current;
    setParsed({ ...parsed, mapping: next });
    setRemapping(true);
    try {
      const result = await requestJson<ParseResult>("/api/parse", {
        method: "POST",
        body: JSON.stringify({ parseId: parsed.parseId, mapping: next }),
      });
      if (token !== remapToken.current) return;
      setParsed(result);
      setDrafts(toDrafts(result.items));
    } catch (reason) {
      if (token === remapToken.current) {
        toast.error(reason instanceof Error ? reason.message : "Zuordnung fehlgeschlagen");
      }
    } finally {
      if (token === remapToken.current) setRemapping(false);
    }
  }

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  }

  const allPricedSelected = useMemo(() => {
    const priced = drafts.filter((draft) => draft.unitPrice != null);
    return priced.length > 0 && priced.every((draft) => draft.selected);
  }, [drafts]);

  async function save() {
    if (!parsed) return;
    if (!supplier.trim()) {
      toast.error("Bitte den Großhändler eintragen.");
      return;
    }
    const items = drafts
      .filter((draft) => draft.selected)
      .map((draft) => ({
        ...draft,
        unitPrice: draft.priceText.trim() ? parseGermanNumber(draft.priceText) : null,
      }))
      .filter((draft) => draft.unitPrice != null && (draft.name || draft.articleNumber));
    if (items.length === 0) {
      toast.error("Keine Position mit Preis ausgewählt.");
      return;
    }
    setSaving(true);
    try {
      await requestJson("/api/import", {
        method: "POST",
        body: JSON.stringify({
          filename: parsed.filename,
          supplier: supplier.trim(),
          docType,
          items,
        }),
      });
      notifyLibraryChanged();
      toast.success(`${items.length} Preise gespeichert`);
      router.push("/");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Import</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Rechnung oder Preiskatalog</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        PDF, Excel (.xlsx) oder CSV. Die Datei bleibt auf diesem Rechner. Vor dem Speichern siehst
        du jede Position und kannst Artikel, Einheit und Preis korrigieren. Ohne eigene Datei laden
        die Beispielrechnungen von Pollin und Elektrohandel Wandelt Stück- und Meterpreise.
      </p>

      {!parsed ? (
        <div className="mt-6">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void parseFile(file);
            }}
            className={`flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? "border-primary bg-primary/10" : "border-border bg-card/40 hover:border-primary/50"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xlsx,.csv,.tsv,.txt,application/pdf,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void parseFile(file);
                event.target.value = "";
              }}
            />
            {reading ? (
              <>
                <Loader2Icon className="size-6 animate-spin text-primary" />
                <p className="mt-3 text-base font-medium">Datei wird gelesen…</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tabellen und Rechnungszeilen werden auf Einzelpreise abgesucht.
                </p>
              </>
            ) : (
              <>
                <span className="grid size-12 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                  <UploadIcon />
                </span>
                <p className="mt-4 text-base font-medium">Datei hierher ziehen oder auswählen</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Digitale PDF, XLSX, CSV. Gescannte PDFs ohne Textlayer werden nicht gelesen.
                  Ältere .xls-Dateien bitte zuerst als .xlsx speichern.
                </p>
                <Button type="button" className="mt-5 h-10" onClick={() => inputRef.current?.click()}>
                  <FileSpreadsheetIcon />
                  Datei auswählen
                </Button>
              </>
            )}
          </label>
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              variant="outline"
              className="h-10"
              disabled={sampling || reading}
              onClick={() => void loadExamples()}
            >
              {sampling ? <Loader2Icon className="animate-spin" /> : null}
              Beispielrechnungen laden
            </Button>
          </div>
          {error ? (
            <div className="mt-4 flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{parsed.filename}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pricedCount} von {drafts.length} Positionen haben einen Preis
                {remapping ? " · Zuordnung wird neu gelesen" : ""}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setParsed(null);
                setDrafts([]);
                setError("");
              }}
            >
              Andere Datei
            </Button>
          </div>

          {parsed.warnings.length > 0 ? (
            <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
              <ul className="grid gap-1">
                {parsed.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 rounded-xl border border-border bg-card/60 p-4 md:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="supplier">Großhändler</Label>
              <Input
                id="supplier"
                list="known-suppliers"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                placeholder="z. B. Elektro Wagner"
              />
              <datalist id="known-suppliers">
                {suppliers.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Art der Datei</span>
              <div className="flex h-8 gap-1 rounded-lg bg-muted p-0.5">
                {(
                  [
                    ["katalog", "Preiskatalog"],
                    ["rechnung", "Rechnung"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={docType === value}
                    onClick={() => setDocType(value)}
                    className={`flex-1 rounded-md text-sm ${
                      docType === value ? "bg-background text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground md:max-w-56 md:self-center">
              Stehen EK und VK nebeneinander, wird der Einkaufspreis genommen. Die Zuordnung kannst
              du darunter ändern.
            </p>
          </div>

          {parsed.headers.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {FIELDS.map((field) => (
                <div key={field} className="grid gap-1.5">
                  <Label>{fieldLabels[field]}</Label>
                  <Select
                    value={parsed.mapping[field] == null ? "none" : String(parsed.mapping[field])}
                    onValueChange={(value) => void updateMapping(field, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugeordnet</SelectItem>
                      {parsed.headers.map((header, index) => (
                        <SelectItem key={`${header}-${index}`} value={String(index)}>
                          {header.trim() || `Spalte ${index + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keine Tabellenüberschrift erkannt. Die Zeilen wurden aus dem Text gelesen. Korrigiere
              sie direkt in der Liste.
            </p>
          )}

          <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={allPricedSelected}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setDrafts((current) =>
                      current.map((draft) =>
                        draft.unitPrice == null ? { ...draft, selected: false } : { ...draft, selected: checked },
                      ),
                    );
                  }}
                />
                Positionen mit Preis
              </label>
              <span className="text-xs text-muted-foreground">{selectedCount} ausgewählt</span>
            </div>
            {drafts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                In dieser Datei wurde keine Bauteilposition erkannt. Prüfe das Format oder ordne die
                Spalten neu zu.
              </p>
            ) : (
              <div className="max-h-[560px] overflow-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="sticky top-0 bg-card text-left text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-2 font-medium" />
                      <th className="px-2 py-2 font-medium">Artikel</th>
                      <th className="px-2 py-2 font-medium">Bezeichnung</th>
                      <th className="px-2 py-2 font-medium">Einheit</th>
                      <th className="px-2 py-2 font-medium">Einzelpreis</th>
                      <th className="px-2 py-2 font-medium">Menge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((draft) => (
                      <tr key={draft.id} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="mt-2 size-4 accent-primary"
                            checked={draft.selected}
                            onChange={(event) => updateDraft(draft.id, { selected: event.target.checked })}
                            aria-label={`${draft.name || draft.articleNumber || "Position"} übernehmen`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={draft.articleNumber}
                            onChange={(event) => updateDraft(draft.id, { articleNumber: event.target.value })}
                            className="h-8 font-mono text-xs"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={draft.name}
                            onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                            className="h-8"
                          />
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Badge variant={draft.confidence === "niedrig" ? "outline" : "secondary"}>
                              {draft.confidence}
                            </Badge>
                            {draft.note ? (
                              <span className="text-[11px] text-muted-foreground">{draft.note}</span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={draft.unit}
                            onChange={(event) => updateDraft(draft.id, { unit: event.target.value })}
                            className="h-8 w-20"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={draft.priceText}
                            onChange={(event) =>
                              updateDraft(draft.id, {
                                priceText: event.target.value,
                                unitPrice: event.target.value.trim()
                                  ? parseGermanNumber(event.target.value)
                                  : null,
                              })
                            }
                            className="price h-8 w-28 bg-transparent"
                            inputMode="decimal"
                          />
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {draft.quantity == null ? "—" : formatNumber(draft.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="sticky bottom-3 flex flex-col gap-2 rounded-xl border border-border bg-popover/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedCount === 0
                ? "Wähle mindestens eine Position mit Preis."
                : `${selectedCount} Preise werden in die Bibliothek übernommen.`}
            </p>
            <Button className="h-10" onClick={() => void save()} disabled={saving || selectedCount === 0}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              Preise speichern
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function toDrafts(items: ExtractedItem[]): Draft[] {
  return items.map((item) => ({
    ...item,
    selected: item.unitPrice != null && Boolean(item.name || item.articleNumber),
    priceText: formatNumber(item.unitPrice),
  }));
}
