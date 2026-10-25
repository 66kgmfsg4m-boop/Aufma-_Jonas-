"use client";

import { requestJson } from "@/components/api";
import { TakePartButton } from "@/components/take-part-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { docTypeLabel, formatEuro, formatNumber, formatUnit, formatWhen } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import { sellPrice } from "@/lib/pricing";
import type { Part } from "@/lib/types";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function PartSheet({
  part,
  onOpenChange,
  onUpdated,
  onDeleted,
}: {
  part: Part | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (part: Part) => void;
  onDeleted: (id: string) => void;
}) {
  return (
    <Sheet open={part != null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {part ? (
          <PartForm
            key={part.id}
            part={part}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onOpenRelated={(next) => onUpdated(next)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PartForm({
  part,
  onUpdated,
  onDeleted,
  onOpenRelated,
}: {
  part: Part;
  onUpdated: (part: Part) => void;
  onDeleted: (id: string) => void;
  onOpenRelated: (part: Part) => void;
}) {
  const [articleNumber, setArticleNumber] = useState(part.articleNumber);
  const [name, setName] = useState(part.name);
  const [unit, setUnit] = useState(part.unit);
  const [priceText, setPriceText] = useState(formatNumber(part.unitPrice));
  const [related, setRelated] = useState<Part[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ related: Part[] }>(`/api/parts/${part.id}`)
      .then((data) => {
        if (!cancelled) setRelated(data.related);
      })
      .catch(() => {
        if (!cancelled) setRelated([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRelated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [part.id]);

  async function save() {
    const unitPrice = priceText.trim() ? parseGermanNumber(priceText) : null;
    if (priceText.trim() && unitPrice == null) {
      toast.error("Der Preis ist keine gültige Zahl. Beispiel: 0,89");
      return;
    }
    setSaving(true);
    try {
      const data = await requestJson<{ part: Part; related: Part[] }>(`/api/parts/${part.id}`, {
        method: "PATCH",
        body: JSON.stringify({ articleNumber, name, unit, unitPrice }),
      });
      setRelated(data.related);
      onUpdated(data.part);
      toast.success("Bauteil gespeichert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await requestJson(`/api/parts/${part.id}`, { method: "DELETE" });
      onDeleted(part.id);
      toast.success("Bauteil gelöscht");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Löschen fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SheetHeader className="pr-10">
        <p className="font-mono text-[10px] tracking-[0.16em] text-primary uppercase">
          {part.supplier}
        </p>
        <SheetTitle className="text-lg">{name || articleNumber || "Bauteil"}</SheetTitle>
        <SheetDescription>
          {docTypeLabel(part.docType)} · {part.sourceFile}
          {part.importedAt ? ` · ${formatWhen(part.importedAt)}` : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Einkauf</p>
            <p className="mt-1 text-xl text-muted-foreground tabular-nums">
              {formatEuro(parseGermanNumber(priceText) ?? part.unitPrice)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{formatUnit(unit)}</p>
          </div>
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
            <p className="font-mono text-[10px] tracking-[0.14em] text-primary uppercase">VK +20 %</p>
            <p className="price mt-1 text-xl">
              {formatEuro(sellOf(parseGermanNumber(priceText) ?? part.unitPrice))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Basis der Rechnung</p>
          </div>
        </div>
        {part.priceBasis > 1 ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Ursprünglich je {part.priceBasis} {unit || "Einheiten"} geführt
          </p>
        ) : null}
        <TakePartButton part={{ ...part, unitPrice: parseGermanNumber(priceText) ?? part.unitPrice, name, unit, articleNumber }} />
        <div className="grid gap-3">
          <Field label="Artikelnummer" value={articleNumber} onChange={setArticleNumber} />
          <Field label="Bezeichnung" value={name} onChange={setName} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Einheit" value={unit} onChange={setUnit} placeholder="Stk, m, m²" />
            <Field label="Einzelpreis" value={priceText} onChange={setPriceText} placeholder="0,89" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Änderung speichern
          </Button>
          {confirmDelete ? (
            <Button variant="destructive" onClick={() => void remove()} disabled={saving}>
              Endgültig löschen
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setConfirmDelete(true)}>
              Löschen
            </Button>
          )}
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            Weitere Preise zu dieser Artikelnummer
          </p>
          {loadingRelated ? (
            <p className="mt-2 text-sm text-muted-foreground">Preise werden verglichen…</p>
          ) : related.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Bisher nur dieser eine Preis. Weitere Rechnungen oder Kataloge mit derselben
              Artikelnummer erscheinen hier.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
              {related.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/60"
                    onClick={() => onOpenRelated(other)}
                  >
                    <span>
                      <span className="block text-sm">{other.supplier}</span>
                      <span className="text-xs text-muted-foreground">
                        {docTypeLabel(other.docType)} · {formatWhen(other.importedAt)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[11px] text-muted-foreground">EK {formatEuro(other.unitPrice)}</span>
                      <span className="price text-base">{formatEuro(sellOf(other.unitPrice))}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

function sellOf(value: number | null): number | null {
  if (value == null) return null;
  return sellPrice(value);
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
