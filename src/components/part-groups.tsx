"use client";

import { TakePartButton } from "@/components/take-part-button";
import { Badge } from "@/components/ui/badge";
import { docTypeLabel, formatEuro, formatUnit, formatWhen } from "@/lib/format";
import { groupParts } from "@/lib/groups";
import { sellPrice } from "@/lib/pricing";
import type { Part } from "@/lib/types";

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
  const groups = groupParts(parts);

  return (
    <ul className="grid gap-2">
      {groups.map((group) => {
        const cheapest = group.offers[0];
        const cost = cheapest?.unitPrice ?? null;
        const several = group.offers.length > 1;
        return (
          <li key={group.key} className="overflow-hidden rounded-xl border border-border bg-card/70">
            <div className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {group.articleNumber || "ohne Nummer"}
                    </span>
                    <span className="mt-0.5 block text-sm">{group.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatUnit(group.unit)}</span>
                      {cheapest && !several ? (
                        <>
                          <span>·</span>
                          <button type="button" className="hover:text-foreground" onClick={() => onOpen?.(cheapest)}>
                            {cheapest.supplier}
                          </button>
                        </>
                      ) : null}
                      {several ? <Badge variant="secondary">{group.offers.length} Preise</Badge> : null}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                      VK +20 %
                    </span>
                    <span className="price block text-lg">{formatEuro(cost == null ? null : sellPrice(cost))}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      EK {formatEuro(cost)}
                      {several ? " günstigster" : ""}
                    </span>
                  </span>
                </span>
              </div>
              {several || !cheapest ? null : (
                <TakePartButton part={cheapest} orderId={orderId} onAdded={onAdded} />
              )}
            </div>
            {several ? (
              <ul className="divide-y divide-border border-t border-border">
                {group.offers.map((offer) => (
                  <li key={offer.id} className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onOpen?.(offer)}
                    >
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
      })}
    </ul>
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
