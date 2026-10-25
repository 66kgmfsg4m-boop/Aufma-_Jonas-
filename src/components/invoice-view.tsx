"use client";

import { requestJson } from "@/components/api";
import { InvoiceSheet } from "@/components/invoice-sheet";
import { Button } from "@/components/ui/button";
import { berlinToday } from "@/lib/format";
import { buildInvoiceModel } from "@/lib/quote";
import type { AppSettings, JobOrder } from "@/lib/types";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function InvoiceView({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<JobOrder | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ order: JobOrder }>(`/api/orders/${id}`)
      .then((data) => {
        if (!cancelled) setOrder(data.order);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    void requestJson<{ settings: AppSettings }>("/api/settings")
      .then((data) => {
        if (!cancelled) setSettings(data.settings);
      })
      .catch(() => {
        if (!cancelled) setSettings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function archive() {
    setSaving(true);
    try {
      const data = await requestJson<{ id: string }>(`/api/invoices`, {
        method: "POST",
        body: JSON.stringify({ orderId: id }),
      });
      toast.success("In der Historie gespeichert");
      router.push(`/rechnungen/${data.id}`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <div className="px-4 py-10">
        <p>Diesen Auftrag gibt es nicht mehr.</p>
      </div>
    );
  }

  if (!order || !settings) {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto h-96 max-w-3xl animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  const model = buildInvoiceModel(
    order,
    settings,
    order.number,
    new Date().toISOString(),
    order.invoiceDate || berlinToday(),
  );

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href={`/auftraege/${order.id}`}>Zurück zum Auftrag</Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void archive()} disabled={saving}>
            In die Historie
          </Button>
          <Button onClick={() => window.print()}>
            <PrinterIcon />
            Drucken oder als PDF speichern
          </Button>
        </div>
      </div>
      <InvoiceSheet model={model} />
    </div>
  );
}
