"use client";

import { TakePartButton } from "@/components/take-part-button";
import { bucketGroups, type CategoryId } from "@/lib/classify";
import { docTypeLabel, formatEuro, formatUnit, formatWhen } from "@/lib/format";
import { groupParts, type PartGroup } from "@/lib/groups";
import { sellPrice } from "@/lib/pricing";
import type { Part } from "@/lib/types";
import { cn } from "cn";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const groups = useMemo(() => groupParts(parts), [parts]);
  const buckets = useMemo(() => bucketGroups(groups), [groups]);
  const [picked, setPicked] = useState<CategoryId | null>(null);
  const active = picked && buckets.some((bucket) => bucket.category.id === picked) ? picked : null;
  const shown = active ? buckets.filter((bucket) => bucket.category.id === active) : buckets;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  if (groups.length === 0) return null;

  return (
    <div className="grid gap-4">
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
        {buckets.map((bucket) => {
          const selected = active === bucket.category.id;
          const color = bucket.category.color;
          return (
            <button
              key={bucket.category.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPicked(selected ? null : bucket.category.id)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition-opacity",
                active != null && !selected && "opacity-40 hover:opacity-100",
              )}
              style={{
                borderColor: selected ? color : tint(color, 42),
                background: tint(color, selected ? 30 : 11),
                boxShadow: selected ? `inset 4px 0 0 ${color}, 0 0 0 1px ${color}` : `inset 3px 0 0 ${color}`,
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
                ab {formatEuro(lowestSell(bucket.groups))}
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
            borderColor: tint(bucket.category.color, 45),
            background: tint(bucket.category.color, 8),
          }}
        >
          <header className="flex items-center gap-2 px-4 py-3">
            <span className="size-2.5 rounded-full" style={{ background: bucket.category.color }} />
            <h2 className="text-sm font-semibold">{bucket.category.label}</h2>
            <span className="text-xs text-muted-foreground">{bucket.category.hint}</span>
            <span className="ml-auto font-mono text-sm tabular-nums" style={{ color: bucket.category.color }}>
              {bucket.groups.length}
            </span>
          </header>
          <ul className="border-t bg-background/55" style={{ borderColor: tint(bucket.category.color, 35) }}>
            {bucket.groups.map((group) => (
              <GroupRow
                key={group.key}
                group={group}
                color={bucket.category.color}
                orderId={orderId}
                onOpen={onOpen}
                onAdded={onAdded}
              />
            ))}
          </ul>
        </section>
        ))}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  color,
  orderId,
  onOpen,
  onAdded,
}: {
  group: PartGroup;
  color: string;
  orderId?: string;
  onOpen?: (part: Part) => void;
  onAdded?: () => void;
}) {
  const cheapest = group.offers[0];
  const cost = cheapest?.unitPrice ?? null;
  const several = group.offers.length > 1;

  return (
    <li className="border-b border-border/70 last:border-b-0" style={{ boxShadow: `inset 3px 0 0 ${color}` }}>
      <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-mono text-[11px]" style={{ color }}>
              {group.articleNumber || "ohne Nummer"}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatUnit(group.unit)}</span>
            {several ? (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px]"
                style={{ color, background: tint(color, 18) }}
              >
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
              VK +20 %
            </span>
            <span className="price block text-lg">{formatEuro(cost == null ? null : sellPrice(cost))}</span>
            <span className="block text-[11px] text-muted-foreground">
              EK {formatEuro(cost)}
              {several ? " günstigster" : ""}
            </span>
          </span>
          {several || !cheapest ? null : <TakePartButton part={cheapest} orderId={orderId} onAdded={onAdded} />}
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
                <PricePair cost={offer.unitPrice} />
                <TakePartButton part={offer} orderId={orderId} onAdded={onAdded} label="Übernehmen" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function PricePair({ cost }: { cost: number | null }) {
  return (
    <span className="grid grid-cols-2 gap-3 text-right">
      <span>
        <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">EK</span>
        <span className="block text-sm text-muted-foreground">{formatEuro(cost)}</span>
      </span>
      <span>
        <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">VK</span>
        <span className="price block text-base">{formatEuro(cost == null ? null : sellPrice(cost))}</span>
      </span>
    </span>
  );
}

function lowestSell(groups: PartGroup[]): number | null {
  let cost = Number.POSITIVE_INFINITY;
  for (const group of groups) {
    for (const offer of group.offers) {
      if (offer.unitPrice != null && offer.unitPrice < cost) cost = offer.unitPrice;
    }
  }
  return Number.isFinite(cost) ? sellPrice(cost) : null;
}

function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}
