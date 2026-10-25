"use client";

import { notifyLibraryChanged, requestJson } from "@/components/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { docTypeLabel, formatWhen } from "@/lib/format";
import type { PriceDocument } from "@/lib/types";
import { Loader2Icon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function QuellenView() {
  const [documents, setDocuments] = useState<PriceDocument[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PriceDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setError("");
    void requestJson<{ documents: PriceDocument[] }>("/api/documents")
      .then((data) => setDocuments(data.documents))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Quellen konnten nicht geladen werden.");
      });
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ documents: PriceDocument[] }>("/api/documents")
      .then((data) => {
        if (!cancelled) setDocuments(data.documents);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Quellen konnten nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove() {
    if (!pending) return;
    setDeleting(true);
    try {
      await requestJson(`/api/documents/${pending.id}`, { method: "DELETE" });
      setDocuments((current) => current?.filter((document) => document.id !== pending.id) ?? []);
      setPending(null);
      notifyLibraryChanged();
      toast.success("Quelle und ihre Preise gelöscht");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Quellen</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Rechnungen und Kataloge</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Jeder Import bleibt als Quelle erhalten. Löschst du sie, verschwinden auch die daraus
        gelesenen Bauteilpreise.
      </p>
      <div className="mt-6">
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            <p>{error}</p>
            <Button variant="outline" className="mt-3" onClick={load}>
              Erneut laden
            </Button>
          </div>
        ) : documents == null ? (
          <div className="grid gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-xl bg-muted/70" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-10">
            <p className="text-lg font-medium">Noch keine Quelle</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Sobald du eine Datei übernimmst, steht sie hier mit Großhändler, Datum und Anzahl der
              Positionen.
            </p>
            <Button asChild className="mt-5 h-10">
              <Link href="/import">
                <UploadIcon />
                Datei importieren
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{document.supplier}</p>
                    <Badge variant="outline">{docTypeLabel(document.docType)}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{document.filename}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatWhen(document.uploadedAt)} · {document.itemCount} Preise
                  </p>
                </div>
                <Button variant="outline" onClick={() => setPending(document)}>
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={pending != null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quelle löschen?</DialogTitle>
            <DialogDescription>
              {pending
                ? `${pending.supplier} · ${pending.filename}. ${pending.itemCount} gespeicherte Preise werden mit entfernt.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Behalten
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={deleting}>
              {deleting ? <Loader2Icon className="animate-spin" /> : null}
              Löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
