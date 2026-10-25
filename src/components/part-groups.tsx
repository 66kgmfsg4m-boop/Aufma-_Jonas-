"use client";

import { notifyLibraryChanged, requestJson } from "@/components/api";
import { TakePartButton } from "@/components/take-part-button";
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
import { bucketGroups, CATEGORIES, type Gewerk } from "@/lib/classify";
import { docTypeLabel, formatEuro, formatUnit, formatWhen } from "@/lib/format";
import { groupParts, type PartGroup } from "@/lib/groups";
import { sellPrice } from "@/lib/pricing";
import type { Part, StoredCategory } from "@/lib/types";
import { cn } from "cn";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

export function PartGroupList({
  parts,
  orderId,
  onOpen,
  onAdded,
}: {
  parts: Part[];
  orderId?: string;
  onOpen?: (part: Part) => void;
  onAdded?: () => void;
}) {
  const [categories, setCategories] = useState<StoredCategory[] | null>(null);
  const [markup, setMarkup] = useState(20);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [over, setOver] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function loadCategories() {
    void requestJson<{ categories: StoredCategory[] }>("/api/categories")
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories(null));
  }

  useEffect(() => {
    loadCategories();
    void requestJson<{ settings: { markupPercent: number } }>("/api/settings")
      .then((data) => setMarkup(data.settings.markupPercent))
      .catch(() => {});
  }, []);

  const catalog: readonly Gewerk[] = categories && categories.length > 0 ? categories : CATEGORIES;
  const adjusted = useMemo(
    () => parts.map((part) => (moved[part.id] ? { ...part, categoryId: moved[part.id]! } : part)),
    [parts, moved],
  );
  const groups = useMemo(() => groupParts(adjusted), [adjusted]);
  const tiles = useMemo(() => bucketGroups(groups, catalog, true), [groups, catalog]);
  const active = picked && tiles.some((bucket) => bucket.category.id === picked) ? picked : null;
  const shown = (active ? tiles.filter((bucket) => bucket.category.id === active) : tiles).filter(
    (bucket) => bucket.groups.length > 0 || bucket.category.id === active,
  );

  useEffect(() => {
    if (!active) return;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  async function move(ids: string[], categoryId: string) {
    try {
      await requestJson("/api/parts/move", {
        method: "POST",
        body: JSON.stringify({ ids, categoryId }),
      });
      setMoved((current) => {
        const next = { ...current };
        for (const id of ids) next[id] = categoryId;
        return next;
      });
      setPicked(categoryId);
      notifyLibraryChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Das Gewerk wurde nicht geändert.");
    }
  }

  function onDrop(event: DragEvent, categoryId: string) {
    event.preventDefault();
    setOver(null);
    const ids = event.dataTransfer.getData("text/plain").split(",").filter(Boolean);
    if (ids.length === 0) return;
    void move(ids, categoryId);
  }

  if (groups.length === 0 && catalog.length === 0) return null;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Bauteil auf ein Gewerk ziehen, oder das Gewerk in der Zeile wählen.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setManage(true)}>
          Gewerke
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          aria-pressed={active == null}
          onClick={() => setPicked(null)}
          className={cn(
            "rounded-xl border px-3 py-3 text-left transition-opacity",
            active == null ? "border-primary/50 bg-primary/15" : "border-border bg-card/50 opacity-60 hover:opacity-100",
          )}
        >
          <span className="block font-mono text-[10px] tracking-[0.16em] text-primary uppercase">Übersicht</span>
          <span className="mt-1 block font-mono text-2xl text-primary tabular-nums">{groups.length}</span>
          <span className="text-xs text-muted-foreground">alle Gewerke</span>
        </button>
        {tiles.map((bucket) => {
          const selected = active === bucket.category.id;
          const color = bucket.category.color;
          const hovering = over === bucket.category.id;
          return (
            <button
              key={bucket.category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPicked(selected ? null : bucket.category.id)}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(bucket.category.id);
              }}
              onDragLeave={() => setOver((current) => (current === bucket.category.id ? null : current))}
              onDrop={(event) => onDrop(event, bucket.category.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-opacity",
                active != null && !selected && "opacity-40 hover:opacity-100",
                hovering && "scale-[1.02]",
              )}
              style={{
                borderColor: hovering || selected ? color : tint(color, 42),
                background: tint(color, hovering || selected ? 30 : 11),
                boxShadow: selected || hovering ? `inset 4px 0 0 ${color}, 0 0 0 1px ${color}` : `inset 3px 0 0 ${color}`,
              }}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: color }} />
                <span className="font-mono text-[10px] tracking-[0.16em] uppercase" style={{ color }}>
                  {bucket.category.label}
                </span>
              </span>
              <span className="mt-1 block font-mono text-2xl tabular-nums" style={{ color }}>
                {bucket.groups.length}
              </span>
              <span className="text-xs text-muted-foreground">
                {bucket.groups.length === 0 ? "hier ablegen" : `ab ${formatEuro(lowestSell(bucket.groups, markup))}`}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={listRef} className="grid scroll-mt-20 gap-4">
        {shown.map((bucket) => (
          <section
            key={bucket.category.id}
            className="overflow-hidden rounded-2xl border"
            style={{
              borderColor: over === bucket.category.id ? bucket.category.color : tint(bucket.category.color, 45),
              background: tint(bucket.category.color, 8),
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(bucket.category.id);
            }}
            onDragLeave={() => setOver((current) => (current === bucket.category.id ? null : current))}
            onDrop={(event) => onDrop(event, bucket.category.id)}
          >
            <header className="flex items-center gap-2 px-4 py-3">
              <span className="size-2.5 rounded-full" style={{ background: bucket.category.color }} />
              <h2 className="text-sm font-semibold">{bucket.category.label}</h2>
              <span className="text-xs text-muted-foreground">{bucket.category.hint}</span>
              <span className="ml-auto font-mono text-sm tabular-nums" style={{ color: bucket.category.color }}>
                {bucket.groups.length}
              </span>
            </header>
            {bucket.groups.length === 0 ? (
              <p className="border-t px-4 py-6 text-sm text-muted-foreground" style={{ borderColor: tint(bucket.category.color, 35) }}>
                Noch nichts in diesem Gewerk. Ziehe ein Bauteil auf die Kachel.
              </p>
            ) : (
              <ul className="border-t bg-background/55" style={{ borderColor: tint(bucket.category.color, 35) }}>
                {bucket.groups.map((group) => (
                  <GroupRow
                    key={group.key}
                    group={group}
                    color={bucket.category.color}
                    categoryId={bucket.category.id}
                    categories={catalog}
                    markup={markup}
                    orderId={orderId}
                    onOpen={onOpen}
                    onAdded={onAdded}
                    onMove={(ids, categoryId) => void move(ids, categoryId)}
                  />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <CategoryDialog
        open={manage}
        categories={categories ?? []}
        onOpenChange={setManage}
        onChanged={loadCategories}
      />
    </div>
  );
}

function GroupRow({
  group,
  color,
  categoryId,
  categories,
  markup,
  orderId,
  onOpen,
  onAdded,
  onMove,
}: {
  group: PartGroup;
  color: string;
  categoryId: string;
  categories: readonly Gewerk[];
  markup: number;
  orderId?: string;
  onOpen?: (part: Part) => void;
  onAdded?: () => void;
  onMove: (ids: string[], categoryId: string) => void;
}) {
  const cheapest = group.offers[0];
  const cost = cheapest?.unitPrice ?? null;
  const several = group.offers.length > 1;
  const ids = group.offers.map((offer) => offer.id);

  return (
    <li
      className="border-b border-border/70 last:border-b-0"
      style={{ boxShadow: `inset 3px 0 0 ${color}` }}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", ids.join(","));
        event.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[11px]" style={{ color }}>
              {group.articleNumber || "ohne Nummer"}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatUnit(group.unit)}</span>
            {several ? (
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px]" style={{ color, background: tint(color, 18) }}>
                {group.offers.length} Preise
              </span>
            ) : null}
          </span>
          {several || !cheapest ? (
            <span className="mt-0.5 block text-sm leading-snug">{group.name}</span>
          ) : (
            <button
              type="button"
              className="mt-0.5 block text-left text-sm leading-snug hover:text-primary"
              onClick={() => onOpen?.(cheapest)}
            >
              <span className="line-clamp-2">{group.name}</span>
            </button>
          )}
          <label className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            Gewerk
            <select
              aria-label={`Gewerk für ${group.name}`}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
              value={categoryId}
              onChange={(event) => onMove(ids, event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          {cheapest && !several ? (
            <button
              type="button"
              className="mt-0.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onOpen?.(cheapest)}
            >
              {cheapest.supplier}
            </button>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-right">
            <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              VK +{formatMarkup(markup)} %
            </span>
            <span className="price block text-lg">{formatEuro(cost == null ? null : sellPrice(cost, markup))}</span>
            <span className="block text-[11px] text-muted-foreground">
              EK {formatEuro(cost)}
              {several ? " günstigster" : ""}
            </span>
          </span>
          {several || !cheapest ? null : (
            <TakePartButton part={cheapest} orderId={orderId} onAdded={onAdded} markupPercent={markup} />
          )}
        </div>
      </div>
      {several ? (
        <ul className="divide-y divide-border/70 border-t border-border/70">
          {group.offers.map((offer) => (
            <li key={offer.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen?.(offer)}>
                <span className="block text-sm">{offer.supplier}</span>
                <span className="text-xs text-muted-foreground">
                  {docTypeLabel(offer.docType)} · {offer.sourceFile} · {formatWhen(offer.importedAt)}
                </span>
              </button>
              <span className="flex flex-wrap items-center gap-4">
                <PricePair cost={offer.unitPrice} markup={markup} />
                <TakePartButton part={offer} orderId={orderId} onAdded={onAdded} label="Übernehmen" markupPercent={markup} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PricePair({ cost, markup }: { cost: number | null; markup: number }) {
  return (
    <span className="grid grid-cols-2 gap-3 text-right">
      <span>
        <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">EK</span>
        <span className="block text-sm text-muted-foreground">{formatEuro(cost)}</span>
      </span>
      <span>
        <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">VK</span>
        <span className="price block text-base">{formatEuro(cost == null ? null : sellPrice(cost, markup))}</span>
      </span>
    </span>
  );
}

function CategoryDialog({
  open,
  categories,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  categories: StoredCategory[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await requestJson("/api/categories", { method: "POST", body: JSON.stringify({ label }) });
      setLabel("");
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Gewerk nicht angelegt");
    } finally {
      setSaving(false);
    }
  }

  async function rename(category: StoredCategory, next: string) {
    if (!next.trim() || next.trim() === category.label) return;
    try {
      await requestJson(`/api/categories/${category.id}`, {
        method: "PATCH",
        body: JSON.stringify({ label: next }),
      });
      onChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Umbenennen fehlgeschlagen");
    }
  }

  async function remove(category: StoredCategory) {
    try {
      await requestJson(`/api/categories/${category.id}`, { method: "DELETE" });
      onChanged();
      notifyLibraryChanged();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gewerke</DialogTitle>
          <DialogDescription>
            Eigene Kategorien bleiben gespeichert. Liegt ein Bauteil in keinem Gewerk, gilt die automatische Zuordnung.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid max-h-80 gap-2 overflow-y-auto">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full" style={{ background: category.color }} />
              <Input
                aria-label={`Name ${category.label}`}
                defaultValue={category.label}
                key={`${category.id}-${category.label}`}
                onBlur={(event) => void rename(category, event.target.value)}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => void remove(category)}>
                Weg
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={label}
            placeholder="Neues Gewerk, zum Beispiel SAT"
            aria-label="Neues Gewerk"
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void add();
            }}
          />
          <Button type="button" onClick={() => void add()} disabled={saving}>
            Anlegen
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function lowestSell(groups: PartGroup[], markup: number): number | null {
  let cost = Number.POSITIVE_INFINITY;
  for (const group of groups) {
    for (const offer of group.offers) {
      if (offer.unitPrice != null && offer.unitPrice < cost) cost = offer.unitPrice;
    }
  }
  return Number.isFinite(cost) ? sellPrice(cost, markup) : null;
}

function formatMarkup(value: number): string {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);
}

function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
