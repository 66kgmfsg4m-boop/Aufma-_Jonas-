"use client";

import { requestJson } from "@/components/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDay, formatEuro } from "@/lib/format";
import type { JobOrder, OrderSummary } from "@/lib/types";
import { Loader2Icon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function OrdersView() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setError("");
    void requestJson<{ orders: OrderSummary[] }>("/api/orders")
      .then((data) => setOrders(data.orders))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Aufträge konnten nicht geladen werden.");
      });
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ orders: OrderSummary[] }>("/api/orders")
      .then((data) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Aufträge konnten nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    if (!title.trim()) {
      toast.error("Der Auftrag braucht einen Namen.");
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<{ order: JobOrder }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ title, customer }),
      });
      setOpen(false);
      setTitle("");
      setCustomer("");
      setOrders((current) => [
        {
          id: data.order.id,
          seq: data.order.seq,
          number: data.order.number,
          title: data.order.title,
          customer: data.order.customer,
          createdAt: data.order.createdAt,
          updatedAt: data.order.updatedAt,
          lineCount: 0,
          sellTotal: 0,
          payable: data.order.quote.payable,
        },
        ...(current ?? []),
      ]);
      toast.success(`${data.order.number} angelegt`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Anlegen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Aufträge</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Rechnung aus Bauteilen</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Wähle Positionen aus der Bibliothek, trag die Menge ein. Die Rechnung rechnet mit dem
            Verkaufspreis. Kleinteile, Anfahrt, Stunden und Mehrwertsteuer kommen aus den Einstellungen.
          </p>
        </div>
        <Button className="h-10" onClick={() => setOpen(true)}>
          <PlusIcon />
          Neuer Auftrag
        </Button>
      </div>
      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <Button variant="outline" className="mt-3" onClick={load}>
              Erneut laden
            </Button>
          </div>
        ) : orders == null ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-muted/70" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-10">
            <p className="text-lg font-medium">Noch kein Auftrag</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Leg einen Auftrag an und übernimm danach Bauteile aus der Suche. Gleiche Artikel mit
              mehreren Preisen wählst du dort einzeln aus.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/auftraege/${order.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-primary">{order.number}</span>
                    <span className="mt-0.5 block font-medium">{order.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {order.customer || "ohne Kundenname"} · {formatDay(order.createdAt)} · {order.lineCount}{" "}
                      Positionen
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="price block text-lg">{formatEuro(order.payable)}</span>
                    <span className="text-[11px] text-muted-foreground">zu zahlen</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Neuer Auftrag</DialogTitle>
            <DialogDescription>Der Name steht auf der Rechnung über den Positionen.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="neuer-auftrag">Name</Label>
              <Input
                id="neuer-auftrag"
                value={title}
                placeholder="Sanitär Lerchenweg"
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="neuer-kunde">Kunde</Label>
              <Input
                id="neuer-kunde"
                value={customer}
                placeholder="optional"
                onChange={(event) => setCustomer(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void create()} disabled={saving}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
