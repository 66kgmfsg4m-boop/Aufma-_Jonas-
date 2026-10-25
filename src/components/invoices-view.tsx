"use client";

import { requestJson } from "@/components/api";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { Button } from "@/components/ui/button";
import { formatEuro, formatWhen } from "@/lib/format";
import type { InvoiceModel, InvoiceSummary } from "@/lib/types";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function InvoicesView() {
  const [invoices, setInvoices] = useState<InvoiceSummary[] | null>(null);
  const [error, setError] = useState("");

  function load() {
    setError("");
    void requestJson<{ invoices: InvoiceSummary[] }>("/api/invoices")
      .then((data) => setInvoices(data.invoices))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Die Historie konnte nicht geladen werden.");
      });
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ invoices: InvoiceSummary[] }>("/api/invoices")
      .then((data) => {
        if (!cancelled) setInvoices(data.invoices);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Die Historie konnte nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Rechnungen</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Historie</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Jede gespeicherte Rechnung behält Preise, Adresse und Sätze so, wie sie beim Ablegen waren.
      </p>
      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <Button variant="outline" className="mt-3" onClick={load}>
              Erneut laden
            </Button>
          </div>
        ) : invoices == null ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
        ) : invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-10">
            <p className="text-lg font-medium">Noch keine gespeicherte Rechnung</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Öffne einen Auftrag, geh auf Rechnung und wähle „In die Historie“.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.id}>
                <Link
                  href={`/rechnungen/${invoice.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-primary">{invoice.number}</span>
                    <span className="mt-0.5 block font-medium">{invoice.title || invoice.customer || "Rechnung"}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {invoice.customer || "ohne Kundenname"} · {formatWhen(invoice.issuedAt)}
                    </span>
                  </span>
                  <span className="price text-lg">{formatEuro(invoice.payable)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function InvoiceHistoryView({ id }: { id: string }) {
  const [model, setModel] = useState<InvoiceModel | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ model: InvoiceModel }>(`/api/invoices/${id}`)
      .then((data) => {
        if (!cancelled) setModel(data.model);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <div className="px-4 py-10">
        <p>Diese Rechnung gibt es nicht mehr.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/rechnungen">Zur Historie</Link>
        </Button>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href="/rechnungen">Zur Historie</Link>
        </Button>
        <Button onClick={() => window.print()}>
          <PrinterIcon />
          Drucken oder als PDF speichern
        </Button>
      </div>
      <InvoiceSheet model={model} />
    </div>
  );
}
