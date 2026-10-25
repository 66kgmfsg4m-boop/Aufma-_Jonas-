"use client";

import { requestJson } from "@/components/api";
import { PartGroupList } from "@/components/part-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro, formatNumber, formatUnit } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import type { JobOrder, SearchResponse } from "@/lib/types";
import { PrinterIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function OrderView({ id }: { id: string }) {
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);

  function apply(next: JobOrder) {
    setOrder(next);
    setTitle(next.title);
    setCustomer(next.customer);
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ order: JobOrder }>(`/api/orders/${id}`)
      .then((data) => {
        if (!cancelled) apply(data.order);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof Error && reason.message.includes("nicht mehr")) setMissing(true);
        else setError(reason instanceof Error ? reason.message : "Der Auftrag konnte nicht geladen werden.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void requestJson<SearchResponse>(`/api/search?q=${encodeURIComponent(term)}`)
        .then((data) => {
          if (!cancelled) setHits(data);
        })
        .catch(() => {
          if (!cancelled) setHits(null);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const visibleHits = query.trim() ? hits : null;

  async function saveHead() {
    if (!order || !title.trim()) return;
    if (title.trim() === order.title && customer.trim() === order.customer) return;
    try {
      const data = await requestJson<{ order: JobOrder }>(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, customer }),
      });
      apply(data.order);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    }
  }

  async function saveQuantity(lineId: string, raw: string) {
    const quantity = parseGermanNumber(raw);
    if (quantity == null || quantity <= 0) {
      toast.error("Die Menge muss größer als 0 sein.");
      return;
    }
    try {
      const data = await requestJson<{ order: JobOrder }>(`/api/orders/${id}/lines/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });
      apply(data.order);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Menge nicht gespeichert");
    }
  }

  async function removeLine(lineId: string) {
    try {
      const data = await requestJson<{ order: JobOrder }>(`/api/orders/${id}/lines/${lineId}`, {
        method: "DELETE",
      });
      apply(data.order);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    }
  }

  if (missing) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="text-lg font-medium">Diesen Auftrag gibt es nicht mehr.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/auftraege">Zurück zu den Aufträgen</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">{order.number}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="auftrag-name">Auftrag</Label>
              <Input
                id="auftrag-name"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void saveHead()}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="auftrag-kunde">Kunde</Label>
              <Input
                id="auftrag-kunde"
                value={customer}
                placeholder="optional"
                onChange={(event) => setCustomer(event.target.value)}
                onBlur={() => void saveHead()}
              />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 lg:text-right">
          <p className="font-mono text-[10px] tracking-[0.14em] text-primary uppercase">Rechnungssumme</p>
          <p className="price text-3xl">{formatEuro(order.sellTotal)}</p>
          <p className="text-xs text-muted-foreground">nur Verkaufspreise, EK + 20 %</p>
          <Button asChild className="mt-3 h-10">
            <Link href={`/auftraege/${order.id}/rechnung`}>
              <PrinterIcon />
              Rechnung
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative mt-6">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Bauteil suchen und übernehmen…"
          aria-label="Bauteil zum Auftrag suchen"
          className="h-12 pl-10"
        />
      </div>
      {query.trim() ? (
        <div className="mt-3">
          {searching && !visibleHits ? (
            <p className="text-sm text-muted-foreground">Suche läuft…</p>
          ) : visibleHits && visibleHits.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Kein Bauteil für diese Suche.</p>
          ) : visibleHits ? (
            <PartGroupList
              parts={visibleHits.items}
              orderId={order.id}
              onAdded={() => {
                void requestJson<{ order: JobOrder }>(`/api/orders/${id}`).then((data) => apply(data.order));
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        {order.lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            Noch keine Position. Such oben ein Bauteil oder übernimm es aus der Bibliothek. Bei
            mehreren Preisen derselben Artikelnummer nimmst du die Quelle, die du berechnen willst.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-card/80 text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Bauteil</th>
                  <th className="px-3 py-3 font-medium">Menge</th>
                  <th className="px-3 py-3 font-medium">EK</th>
                  <th className="px-3 py-3 font-medium">VK +20 %</th>
                  <th className="px-3 py-3 font-medium">Summe</th>
                  <th className="px-3 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-3 py-3">
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {line.articleNumber || "ohne Nummer"}
                      </span>
                      <span className="block">{line.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {line.supplier} · {formatUnit(line.unit)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        aria-label={`Menge ${line.name}`}
                        className="w-24"
                        defaultValue={formatNumber(line.quantity)}
                        key={`${line.id}-${line.quantity}`}
                        onBlur={(event) => void saveQuantity(line.id, event.target.value)}
                      />
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{formatEuro(line.unitCost)}</td>
                    <td className="price px-3 py-3">{formatEuro(line.unitSell)}</td>
                    <td className="price px-3 py-3">{formatEuro(line.lineTotal)}</td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Position entfernen"
                        onClick={() => void removeLine(line.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
