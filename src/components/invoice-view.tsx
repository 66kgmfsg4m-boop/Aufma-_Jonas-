"use client";

import { requestJson } from "@/components/api";
import { Button } from "@/components/ui/button";
import { formatDay, formatEuro, formatNumber } from "@/lib/format";
import type { JobOrder } from "@/lib/types";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function InvoiceView({ id }: { id: string }) {
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ order: JobOrder }>(`/api/orders/${id}`)
      .then((data) => {
        if (!cancelled) setOrder(data.order);
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
        <p>Diesen Auftrag gibt es nicht mehr.</p>
      </div>
    );
  }

  if (!order) {
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
          <Link href={`/auftraege/${order.id}`}>Zurück zum Auftrag</Link>
        </Button>
        <Button onClick={() => window.print()} disabled={order.lines.length === 0}>
          <PrinterIcon />
          Drucken oder als PDF speichern
        </Button>
      </div>
      <article className="invoice-sheet mx-auto max-w-3xl rounded-xl bg-[#f4efe4] px-6 py-8 text-[#231e18] shadow-xl md:px-10 md:py-10">
        <header className="flex flex-col gap-4 border-b border-[#231e18]/15 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-[#8a5a12] uppercase">Rechnung</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{order.number}</h1>
            <p className="mt-2 text-sm">{order.title}</p>
            {order.customer ? <p className="text-sm">{order.customer}</p> : null}
          </div>
          <p className="text-sm">{formatDay()}</p>
        </header>
        {order.lines.length === 0 ? (
          <p className="py-10 text-sm">Dieser Auftrag hat noch keine Positionen.</p>
        ) : (
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-[#231e18]/20 text-left text-[11px] tracking-[0.12em] uppercase">
                <th className="py-2 pr-2 font-medium">Pos</th>
                <th className="py-2 pr-2 font-medium">Bauteil</th>
                <th className="py-2 pr-2 font-medium">Menge</th>
                <th className="py-2 pr-2 text-right font-medium">Einzelpreis</th>
                <th className="py-2 text-right font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((line, index) => (
                <tr key={line.id} className="border-b border-[#231e18]/10 align-top">
                  <td className="py-3 pr-2 font-mono text-xs">{index + 1}</td>
                  <td className="py-3 pr-2">
                    <span className="block">{line.name}</span>
                    <span className="text-xs text-[#231e18]/70">
                      {line.articleNumber || "ohne Nummer"}
                      {line.unit ? ` · ${line.unit}` : ""}
                    </span>
                  </td>
                  <td className="py-3 pr-2 tabular-nums">{formatNumber(line.quantity)}</td>
                  <td className="py-3 pr-2 text-right tabular-nums">{formatEuro(line.unitSell)}</td>
                  <td className="py-3 text-right font-medium tabular-nums">{formatEuro(line.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-6 flex items-baseline justify-between gap-4 border-t border-[#231e18]/20 pt-4">
          <span className="text-sm tracking-[0.14em] uppercase">Summe</span>
          <span className="font-mono text-2xl tabular-nums">{formatEuro(order.sellTotal)}</span>
        </p>
      </article>
    </div>
  );
}
