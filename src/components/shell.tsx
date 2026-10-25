"use client";

import { requestJson, LIBRARY_CHANGED } from "@/components/api";
import { formatWhen } from "@/lib/format";
import type { LibraryStats } from "@/lib/types";
import { cn } from "cn";
import { ClipboardListIcon, FolderOpenIcon, RulerIcon, SearchIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const links = [
  { href: "/", label: "Suche", icon: SearchIcon },
  { href: "/import", label: "Import", icon: UploadIcon },
  { href: "/quellen", label: "Quellen", icon: FolderOpenIcon },
  { href: "/auftraege", label: "Aufträge", icon: ClipboardListIcon },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [stats, setStats] = useState<LibraryStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void requestJson<LibraryStats>("/api/stats")
        .then((next) => {
          if (!cancelled) setStats(next);
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        });
    };
    load();
    window.addEventListener(LIBRARY_CHANGED, load);
    return () => {
      cancelled = true;
      window.removeEventListener(LIBRARY_CHANGED, load);
    };
  }, [pathname]);

  return (
    <div className="relative min-h-screen">
      <div className="ledger-grid pointer-events-none fixed inset-0" />
      <div className="relative mx-auto flex min-h-screen max-w-[1440px] flex-col lg:flex-row">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
          <Wordmark />
          <nav className="flex gap-1" aria-label="Bereiche">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "grid size-10 place-items-center rounded-lg text-muted-foreground",
                    active && "bg-primary/15 text-primary",
                  )}
                >
                  <Icon />
                  <span className="sr-only">{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </header>
        <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar/80 px-4 pt-6 pb-16 backdrop-blur-md lg:flex">
          <Wordmark />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Bereiche">
            {links.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    active && "bg-primary/15 text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active && "text-primary")} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-xl border border-border bg-card/70 p-3">
            <p className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
              Bibliothek
            </p>
            <p className="mt-2 font-mono text-2xl text-foreground tabular-nums">
              {stats ? stats.partCount : "–"}
            </p>
            <p className="text-xs text-muted-foreground">
              {stats
                ? `${stats.supplierCount} Großhändler · ${stats.documentCount} Quellen`
                : "wird geladen"}
            </p>
            {stats?.latestImport ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Zuletzt {formatWhen(stats.latestImport)}
              </p>
            ) : null}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Preise liegen lokal in einer SQLite-Datei auf diesem Rechner.
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
        <RulerIcon className="size-4" />
      </span>
      <span>
        <span className="block font-mono text-sm tracking-[0.22em] text-foreground">AUFMASS</span>
        <span className="block text-[11px] text-muted-foreground">Bauteilpreise</span>
      </span>
    </Link>
  );
}
