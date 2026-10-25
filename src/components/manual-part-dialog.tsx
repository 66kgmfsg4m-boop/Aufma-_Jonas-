"use client";

import { notifyLibraryChanged, requestJson } from "@/components/api";
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
import { parseGermanNumber } from "@/lib/parse/text";
import type { StoredCategory } from "@/lib/types";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function ManualPartDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [article, setArticle] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("Stk");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<StoredCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void requestJson<{ categories: StoredCategory[] }>("/api/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, [open]);

  async function save() {
    const unitPrice = parseGermanNumber(price);
    if ((!article.trim() && !name.trim()) || unitPrice == null || unitPrice <= 0) {
      toast.error("Bezeichnung oder Artikelnummer und ein Einkaufspreis größer 0.");
      return;
    }
    setSaving(true);
    try {
      await requestJson("/api/parts", {
        method: "POST",
        body: JSON.stringify({
          articleNumber: article,
          name,
          unit,
          unitPrice,
          supplier,
          categoryId,
        }),
      });
      setArticle("");
      setName("");
      setPrice("");
      setSupplier("");
      notifyLibraryChanged();
      onOpenChange(false);
      toast.success("Position in der Bibliothek");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Position anlegen</DialogTitle>
          <DialogDescription>
            Der Einkaufspreis wird mit dem Aufschlag aus den Einstellungen zum Verkaufspreis.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Artikelnummer" value={article} onChange={setArticle} />
          <Field label="Bezeichnung" value={name} onChange={setName} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Einheit" value={unit} onChange={setUnit} placeholder="Stk, m" />
            <Field label="Einkauf €" value={price} onChange={setPrice} placeholder="0,89" />
          </div>
          <Field label="Großhändler" value={supplier} onChange={setSupplier} placeholder="optional" />
          <div className="grid gap-1.5">
            <Label htmlFor="manuell-gewerk">Gewerk</Label>
            <select
              id="manuell-gewerk"
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              <option value="">automatisch</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2Icon className="animate-spin" /> : null}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const id = `manuell-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
