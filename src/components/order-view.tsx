"use client";

import { requestJson } from "@/components/api";
import { PartGroupList } from "@/components/part-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatEuro, formatNumber, formatUnit } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import { buildQuote } from "@/lib/quote";
import type { Client, JobOrder, SearchResponse } from "@/lib/types";
import { PrinterIcon, SearchIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Draft = {
  title: string;
  customer: string;
  street: string;
  zip: string;
  city: string;
  email: string;
  phone: string;
  kilometers: string;
  hours: string;
  smallParts: boolean;
  discount: string;
  deduction: string;
  serviceDate: string;
  invoiceDate: string;
};

export function OrderView({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const draftRef = useRef<Draft | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  function apply(next: JobOrder, refreshDraft: boolean) {
    setOrder(next);
    if (refreshDraft) setDraft(draftFrom(next));
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ order: JobOrder }>(`/api/orders/${id}`)
      .then((data) => {
        if (!cancelled) apply(data.order, true);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof Error && reason.message.includes("nicht mehr")) setMissing(true);
        else setError(reason instanceof Error ? reason.message : "Der Auftrag konnte nicht geladen werden.");
      });
    void requestJson<{ clients: Client[] }>("/api/clients")
      .then((data) => {
        if (!cancelled) setClients(data.clients);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
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

  function update(partial: Partial<Draft>) {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    setDraft(next);
  }

  async function persist(next: Draft): Promise<boolean> {
    if (!next.title.trim()) {
      toast.error("Der Auftrag braucht einen Namen.");
      return false;
    }
    try {
      const data = await requestJson<{ order: JobOrder }>(`/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...next,
          kilometers: parseGermanNumber(next.kilometers) ?? 0,
          hours: parseGermanNumber(next.hours) ?? 0,
          discount: parseGermanNumber(next.discount) ?? 0,
          deduction: parseGermanNumber(next.deduction) ?? 0,
        }),
      });
      apply(data.order, false);
      draftRef.current = next;
      setDraft(next);
      return true;
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
      return false;
    }
  }

  function commit(partial: Partial<Draft>) {
    if (!draftRef.current) return;
    const next = { ...draftRef.current, ...partial };
    draftRef.current = next;
    setDraft(next);
    void persist(next);
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
      apply(data.order, false);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Menge nicht gespeichert");
    }
  }

  async function removeLine(lineId: string) {
    try {
      const data = await requestJson<{ order: JobOrder }>(`/api/orders/${id}/lines/${lineId}`, {
        method: "DELETE",
      });
      apply(data.order, false);
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

  if (!order || !draft) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  const quote = buildQuote({
    material: order.sellTotal,
    smallPartsOn: draft.smallParts,
    kilometers: parseGermanNumber(draft.kilometers) ?? 0,
    hours: parseGermanNumber(draft.hours) ?? 0,
    discount: parseGermanNumber(draft.discount) ?? 0,
    deduction: parseGermanNumber(draft.deduction) ?? 0,
    markupPercent: order.quote.markupPercent,
    smallPartsPercent: order.quote.smallPartsPercent,
    travelEuroPerKm: order.quote.travelEuroPerKm,
    hourlyRate: order.quote.hourlyRate,
    vatPercent: order.quote.vatPercent,
    skontoPercent: order.quote.skontoPercent,
    skontoDays: order.quote.skontoDays,
    paymentDays: order.quote.paymentDays,
  });

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">{order.number}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Auftrag / Kommission" value={draft.title} onChange={(title) => update({ title })} onBlur={(title) => commit({ title })} />
            <div className="grid gap-1.5">
              <Label htmlFor="auftrag-kunde">Kunde</Label>
              <Input
                id="auftrag-kunde"
                list="bekannte-kunden"
                value={draft.customer}
                onChange={(event) => update({ customer: event.target.value })}
                onBlur={(event) => {
                  const customer = event.target.value;
                  const match = clients.find((client) => client.name.toLowerCase() === customer.trim().toLowerCase());
                  commit(
                    match
                      ? { customer, street: match.street, zip: match.zip, city: match.city, email: match.email, phone: match.phone }
                      : { customer },
                  );
                }}
              />
              <datalist id="bekannte-kunden">
                {clients.map((client) => (
                  <option key={client.id} value={client.name} />
                ))}
              </datalist>
            </div>
            <Field label="Straße" value={draft.street} onChange={(street) => update({ street })} onBlur={(street) => commit({ street })} />
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <Field label="PLZ" value={draft.zip} onChange={(zip) => update({ zip })} onBlur={(zip) => commit({ zip })} />
              <Field label="Ort" value={draft.city} onChange={(city) => update({ city })} onBlur={(city) => commit({ city })} />
            </div>
            <Field label="E-Mail" value={draft.email} onChange={(email) => update({ email })} onBlur={(email) => commit({ email })} />
            <Field label="Telefon" value={draft.phone} onChange={(phone) => update({ phone })} onBlur={(phone) => commit({ phone })} />
            <Field label="Leistungsdatum" type="date" value={draft.serviceDate} onChange={(serviceDate) => update({ serviceDate })} onBlur={(serviceDate) => commit({ serviceDate })} />
            <Field label="Rechnungsdatum" type="date" value={draft.invoiceDate} onChange={(invoiceDate) => update({ invoiceDate })} onBlur={(invoiceDate) => commit({ invoiceDate })} />
          </div>
        </div>
        <div className="w-full rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 lg:w-72">
          <p className="font-mono text-[10px] tracking-[0.14em] text-primary uppercase">Zu zahlen</p>
          <p className="price text-3xl">{formatEuro(quote.payable)}</p>
          <ul className="mt-3 grid gap-1 text-xs text-muted-foreground">
            <li className="flex justify-between gap-3"><span>Material</span><span>{formatEuro(quote.material)}</span></li>
            {draft.smallParts ? (
              <li className="flex justify-between gap-3">
                <span>Kleinteile {formatNumber(quote.smallPartsPercent)} %</span>
                <span>{formatEuro(quote.smallParts)}</span>
              </li>
            ) : null}
            <li className="flex justify-between gap-3"><span>Anfahrt</span><span>{formatEuro(quote.travel)}</span></li>
            <li className="flex justify-between gap-3"><span>Arbeit</span><span>{formatEuro(quote.labor)}</span></li>
            {quote.discount > 0 ? (
              <li className="flex justify-between gap-3"><span>Nachlass</span><span>{formatEuro(-quote.discount)}</span></li>
            ) : null}
            <li className="flex justify-between gap-3"><span>MwSt {formatNumber(quote.vatPercent)} %</span><span>{formatEuro(quote.vat)}</span></li>
          </ul>
          <Button
            className="mt-3 h-10 w-full"
            onClick={() => {
              const current = draftRef.current;
              if (!current) return;
              void persist(current).then((ok) => {
                if (ok) router.push(`/auftraege/${order.id}/rechnung`);
              });
            }}
          >
            <PrinterIcon />
            Rechnung
          </Button>
          <Link href="/einstellungen" className="mt-2 block text-center text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            Sätze in den Einstellungen
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card/50 p-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="stunden">Stunden</Label>
          <div className="flex gap-2">
            <Input
              id="stunden"
              inputMode="decimal"
              value={draft.hours}
              placeholder="0"
              onChange={(event) => update({ hours: event.target.value })}
              onBlur={(event) => commit({ hours: event.target.value })}
            />
            <Button
              type="button"
              onClick={() => {
                if (draftRef.current) void persist(draftRef.current);
              }}
            >
              Stunden speichern
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatEuro(quote.hourlyRate)} pro Stunde
            {quote.hours > 0 ? ` · ${formatEuro(quote.labor)}` : ""}
          </p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="kilometer">Kilometer</Label>
          <Input
            id="kilometer"
            inputMode="decimal"
              value={draft.kilometers}
              placeholder="0"
              onChange={(event) => update({ kilometers: event.target.value })}
              onBlur={(event) => commit({ kilometers: event.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">{formatEuro(quote.travelEuroPerKm)} pro Kilometer</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={draft.smallParts}
            onChange={(event) => commit({ smallParts: event.target.checked })}
          />
          Kleinteilepauschale {formatNumber(quote.smallPartsPercent)} % vom Material
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Nachlass €" value={draft.discount} onChange={(discount) => update({ discount })} onBlur={(discount) => commit({ discount })} />
          <Field label="Abschlag € netto" value={draft.deduction} onChange={(deduction) => update({ deduction })} onBlur={(deduction) => commit({ deduction })} />
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
                void requestJson<{ order: JobOrder }>(`/api/orders/${id}`).then((data) => apply(data.order, false));
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        {order.lines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
            Noch keine Position. Such oben ein Bauteil oder übernimm es aus der Bibliothek.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-card/80 text-left text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-3 font-medium">Bauteil</th>
                  <th className="px-3 py-3 font-medium">Menge</th>
                  <th className="px-3 py-3 font-medium">EK</th>
                  <th className="px-3 py-3 font-medium">VK +{formatNumber(order.quote.markupPercent)} %</th>
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
                      <Button variant="ghost" size="icon" aria-label="Position entfernen" onClick={() => void removeLine(line.id)}>
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

function draftFrom(order: JobOrder): Draft {
  return {
    title: order.title,
    customer: order.customer,
    street: order.street,
    zip: order.zip,
    city: order.city,
    email: order.email,
    phone: order.phone,
    kilometers: order.kilometers ? formatNumber(order.kilometers) : "",
    hours: order.hours ? formatNumber(order.hours) : "",
    smallParts: order.smallParts,
    discount: order.discount ? formatNumber(order.discount) : "",
    deduction: order.deduction ? formatNumber(order.deduction) : "",
    serviceDate: order.serviceDate,
    invoiceDate: order.invoiceDate,
  };
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  type?: string;
}) {
  const id = `auftrag-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onBlur?.(event.target.value)}
      />
    </div>
  );
}
