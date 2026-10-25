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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEuro } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import { sellPrice } from "@/lib/pricing";
import type { JobOrder, OrderSummary, Part } from "@/lib/types";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function TakePartButton({
  part,
  orderId,
  onAdded,
  label = "In den Auftrag",
}: {
  part: Part;
  orderId?: string;
  onAdded?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [choice, setChoice] = useState("__new__");
  const [title, setTitle] = useState("Auftrag");
  const [customer, setCustomer] = useState("");
  const [quantityText, setQuantityText] = useState("1");
  const [saving, setSaving] = useState(false);
  const sell = part.unitPrice == null ? null : sellPrice(part.unitPrice);

  async function addDirect() {
    if (!orderId) return;
    setSaving(true);
    try {
      await requestJson(`/api/orders/${orderId}/lines`, {
        method: "POST",
        body: JSON.stringify({ partId: part.id, quantity: 1 }),
      });
      toast.success("Position übernommen");
      onAdded?.();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Übernehmen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function openDialog() {
    setOpen(true);
    setQuantityText("1");
    try {
      const data = await requestJson<{ orders: OrderSummary[] }>("/api/orders");
      setOrders(data.orders);
      setChoice(data.orders[0]?.id ?? "__new__");
    } catch {
      setOrders([]);
      setChoice("__new__");
    }
  }

  async function submit() {
    const quantity = parseGermanNumber(quantityText);
    if (quantity == null || quantity <= 0) {
      toast.error("Die Menge muss größer als 0 sein. Beispiel: 12 oder 2,5");
      return;
    }
    setSaving(true);
    try {
      let target = choice;
      if (!target || target === "__new__") {
        const created = await requestJson<{ order: JobOrder }>("/api/orders", {
          method: "POST",
          body: JSON.stringify({ title: title.trim() || "Auftrag", customer }),
        });
        target = created.order.id;
      }
      await requestJson(`/api/orders/${target}/lines`, {
        method: "POST",
        body: JSON.stringify({ partId: part.id, quantity }),
      });
      toast.success("Position in den Auftrag übernommen");
      setOpen(false);
      onAdded?.();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Übernehmen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={orderId ? "secondary" : "default"}
        disabled={saving || sell == null}
        onClick={(event) => {
          event.stopPropagation();
          if (orderId) void addDirect();
          else void openDialog();
        }}
      >
        {saving ? <Loader2Icon className="animate-spin" /> : null}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>In den Auftrag</DialogTitle>
            <DialogDescription>
              {part.name || part.articleNumber}. Die Rechnung verwendet den Verkaufspreis{" "}
              {formatEuro(sell)}, das sind 20 % auf den Einkauf von {formatEuro(part.unitPrice)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="auftrag-wahl">Auftrag</Label>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger id="auftrag-wahl" className="w-full">
                  <SelectValue placeholder="Auftrag wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">Neuer Auftrag</SelectItem>
                  {(orders ?? []).map((order) => (
                    <SelectItem key={order.id} value={order.id}>
                      {order.number} · {order.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {choice === "__new__" || !choice ? (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="auftrag-titel">Name</Label>
                  <Input id="auftrag-titel" value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="auftrag-kunde">Kunde</Label>
                  <Input
                    id="auftrag-kunde"
                    value={customer}
                    placeholder="optional"
                    onChange={(event) => setCustomer(event.target.value)}
                  />
                </div>
              </>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="auftrag-menge">Menge</Label>
              <Input
                id="auftrag-menge"
                inputMode="decimal"
                value={quantityText}
                onChange={(event) => setQuantityText(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => void submit()} disabled={saving}>
              {saving ? <Loader2Icon className="animate-spin" /> : null}
              Übernehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
