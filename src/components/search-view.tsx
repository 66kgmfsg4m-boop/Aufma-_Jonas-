"use client";

import { LIBRARY_CHANGED, notifyLibraryChanged, requestJson } from "@/components/api";
import { PartGroupList } from "@/components/part-groups";
import { PartSheet } from "@/components/part-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupParts } from "@/lib/groups";
import type { LibraryStats, Part, SearchResponse } from "@/lib/types";
import { ManualPartDialog } from "@/components/manual-part-dialog";
import { Loader2Icon, PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const units = [
  { value: "all", label: "Alle Einheiten" },
  { value: "Stk", label: "Stück" },
  { value: "m", label: "Meter" },
  { value: "m²", label: "Quadratmeter" },
  { value: "m³", label: "Kubikmeter" },
  { value: "kg", label: "Kilogramm" },
  { value: "other", label: "Weitere" },
];

export function SearchView() {
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [docType, setDocType] = useState("all");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Part | null>(null);
  const [sampling, setSampling] = useState(false);
  const [revision, setRevision] = useState(0);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (unit !== "all") params.set("unit", unit);
      if (supplier !== "all") params.set("supplier", supplier);
      if (docType !== "all") params.set("docType", docType);
      setLoading(true);
      void requestJson<SearchResponse>(`/api/search?${params.toString()}`)
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setError("");
        })
        .catch((reason: unknown) => {
          if (cancelled) return;
          setError(reason instanceof Error ? reason.message : "Die Suche ist fehlgeschlagen.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, unit, supplier, docType, revision]);

  useEffect(() => {
    const load = () => {
      void requestJson<LibraryStats>("/api/stats")
        .then(setStats)
        .catch(() => setStats(null));
    };
    load();
    const refresh = () => {
      load();
      setRevision((value) => value + 1);
    };
    window.addEventListener(LIBRARY_CHANGED, refresh);
    return () => window.removeEventListener(LIBRARY_CHANGED, refresh);
  }, []);

  const items = useMemo(() => data?.items ?? [], [data]);
  const groups = useMemo(() => groupParts(items), [items]);
  const unfiltered = !query.trim() && unit === "all" && supplier === "all" && docType === "all";
  const libraryEmpty =
    unfiltered && (stats?.partCount === 0 || (data?.mode === "recent" && data.total === 0));
  const filteredEmpty = !loading && !libraryEmpty && items.length === 0;

  async function loadSample() {
    setSampling(true);
    try {
      const result = await requestJson<{ parts: number }>("/api/sample", { method: "POST" });
      notifyLibraryChanged();
      toast.success(`${result.parts} Beispielpreise geladen`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Beispielbestand fehlgeschlagen");
    } finally {
      setSampling(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Suche</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        Stück- und Meterpreise
      </h1>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Die Bibliothek ist nach Gewerk gegliedert. Dieselbe Artikelnummer bleibt ein Bauteil, auch
          wenn mehrere Quellen einen Preis nennen. Der Verkaufspreis rechnet den Aufschlag aus den
          Einstellungen auf den Einkauf. In die Rechnung geht nur dieser Preis.
        </p>
        <Button className="h-10 shrink-0" onClick={() => setManual(true)}>
          <PlusIcon />
          Position anlegen
        </Button>
      </div>
      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Artikelnummer, NYM-J, Großhändler…"
          aria-label="Bauteile suchen"
          className="h-12 pl-10 text-base md:text-base"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <FilterSelect label="Einheit" value={unit} onChange={setUnit} options={units} />
        <FilterSelect
          label="Großhändler"
          value={supplier}
          onChange={setSupplier}
          options={[
            { value: "all", label: "Alle Großhändler" },
            ...(stats?.suppliers.map((entry) => ({ value: entry.name, label: entry.name })) ?? []),
          ]}
        />
        <FilterSelect
          label="Quelle"
          value={docType}
          onChange={setDocType}
          options={[
            { value: "all", label: "Rechnung und Katalog" },
            { value: "katalog", label: "Nur Kataloge" },
            { value: "rechnung", label: "Nur Rechnungen" },
          ]}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}
        {loading && !data ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/70" />
            ))}
          </div>
        ) : libraryEmpty ? (
          <EmptyLibrary sampling={sampling} onSample={() => void loadSample()} />
        ) : filteredEmpty ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-base font-medium">Keine Bauteile für diese Suche</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Andere Schreibweise, Einheit oder Großhändler versuchen. Die Bibliothek hat{" "}
              {stats?.partCount ?? 0} Preise.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {data?.mode === "recent"
                ? `${groups.length} Bauteile · ${data.total} Preise in der Bibliothek`
                : `${groups.length} Bauteile · ${data?.total ?? items.length} Preise`}
              {loading ? " · wird aktualisiert" : ""}
            </p>
            <PartGroupList parts={items} onOpen={setActive} />
          </>
        )}
      </div>
      <ManualPartDialog open={manual} onOpenChange={setManual} />
      <PartSheet
        part={active}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
        onUpdated={(next) => {
          setData((current) =>
            current
              ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) }
              : current,
          );
          setActive(next);
        }}
        onDeleted={(id) => {
          setData((current) =>
            current
              ? {
                  ...current,
                  items: current.items.filter((item) => item.id !== id),
                  total: Math.max(0, current.total - 1),
                }
              : current,
          );
          setActive(null);
          notifyLibraryChanged();
        }}
      />
    </div>
  );
}

function EmptyLibrary({ sampling, onSample }: { sampling: boolean; onSample: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/30 bg-card/40 px-5 py-8 md:px-8">
      <p className="text-lg font-medium">Noch keine Bauteile in der Bibliothek</p>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Lade eine Rechnung oder einen Preiskatalog hoch. Stück- und Meterpreise werden daraus
        gelesen, du prüfst die Positionen, und danach kannst du sie hier suchen. Der Beispielbestand
        enthält Kataloge und zwei Großhandelsrechnungen.
      </p>
      <ol className="mt-5 grid gap-3 text-sm md:grid-cols-3">
        {["Datei hochladen", "Preise prüfen", "Bauteil suchen"].map((step, index) => (
          <li key={step} className="rounded-xl border border-border bg-background/40 px-3 py-3">
            <span className="font-mono text-[11px] text-primary">0{index + 1}</span>
            <span className="mt-1 block">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="h-10">
          <Link href="/import">
            <UploadIcon />
            Rechnung oder Katalog
          </Link>
        </Button>
        <Button variant="outline" className="h-10" onClick={onSample} disabled={sampling}>
          {sampling ? <Loader2Icon className="animate-spin" /> : null}
          Beispielbestand laden
        </Button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

