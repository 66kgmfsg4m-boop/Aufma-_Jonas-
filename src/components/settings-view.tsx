"use client";

import { requestJson } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import { parseGermanNumber } from "@/lib/parse/text";
import { DEFAULT_SETTINGS } from "@/lib/quote";
import type { AppSettings } from "@/lib/types";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const numberFields: { key: keyof AppSettings; label: string; hint: string }[] = [
  { key: "markupPercent", label: "Aufschlag auf den Einkauf", hint: "Prozent, Standard 20" },
  { key: "smallPartsPercent", label: "Kleinteilepauschale", hint: "Prozent vom Materialpreis" },
  { key: "travelEuroPerKm", label: "Anfahrt", hint: "Euro pro Kilometer" },
  { key: "hourlyRate", label: "Stundenlohn", hint: "Euro pro Stunde" },
  { key: "vatPercent", label: "Mehrwertsteuer", hint: "Prozent" },
  { key: "skontoPercent", label: "Skonto", hint: "Prozent, 0 blendet den Satz aus" },
  { key: "skontoDays", label: "Skontofrist", hint: "Tage" },
  { key: "paymentDays", label: "Zahlungsziel", hint: "Tage ohne Abzug" },
];

const textFields: { key: keyof AppSettings; label: string; placeholder: string }[] = [
  { key: "companyName", label: "Name", placeholder: "Name oder Firma" },
  { key: "companyStreet", label: "Straße", placeholder: "Straße und Hausnummer" },
  { key: "companyZip", label: "PLZ", placeholder: "PLZ" },
  { key: "companyCity", label: "Ort", placeholder: "Ort" },
  { key: "companyPhone", label: "Telefon", placeholder: "Telefon" },
  { key: "companyEmail", label: "E-Mail", placeholder: "E-Mail" },
  { key: "taxNumber", label: "Steuernummer", placeholder: "Steuernummer" },
  { key: "vatId", label: "USt-IdNr.", placeholder: "USt-IdNr." },
  { key: "bank", label: "Bankverbindung", placeholder: "IBAN, Bank" },
];

export function SettingsView() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [footer, setFooter] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ settings: AppSettings }>("/api/settings")
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setDraft(toDraft(data.settings));
        setFooter(data.settings.footer);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Einstellungen nicht geladen.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (!settings) return;
    const patch: Partial<AppSettings> = { footer };
    for (const field of numberFields) {
      const parsed = parseGermanNumber(draft[field.key] ?? "");
      (patch[field.key] as number) = parsed ?? (DEFAULT_SETTINGS[field.key] as number);
    }
    for (const field of textFields) {
      (patch[field.key] as string) = draft[field.key] ?? "";
    }
    setSaving(true);
    try {
      const data = await requestJson<{ settings: AppSettings }>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSettings(data.settings);
      setDraft(toDraft(data.settings));
      setFooter(data.settings.footer);
      toast.success("Einstellungen gespeichert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    setUploading(true);
    try {
      const data = await requestJson<{ settings: AppSettings }>("/api/template", { method: "POST", body });
      setSettings(data.settings);
      setPreview((value) => value + 1);
      toast.success("Vorlage gespeichert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Hochladen fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  }

  async function removeTemplate() {
    try {
      const data = await requestJson<{ settings: AppSettings }>("/api/template", { method: "DELETE" });
      setSettings(data.settings);
      setPreview((value) => value + 1);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    }
  }

  if (error) {
    return (
      <div className="px-4 py-10 md:px-8">
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="h-40 animate-pulse rounded-xl bg-muted/70" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Einstellungen</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Rechnung und Sätze</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Die hochgeladene PDF ist die Vorlage zum Nachschlagen. Die Felder darunter stehen auf jeder neuen Rechnung.
        Gespeicherte Rechnungen behalten die Werte vom Ausstellungszeitpunkt.
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold">Rechnungsvorlage</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {settings.templateName ? settings.templateName : "Noch keine PDF hochgeladen."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Label htmlFor="vorlage" className="sr-only">
            PDF hochladen
          </Label>
          <Input
            id="vorlage"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
          <Button type="button" variant="outline" disabled={!settings.templateName} onClick={() => void removeTemplate()}>
            Vorlage entfernen
          </Button>
          {uploading ? <Loader2Icon className="size-4 animate-spin" /> : null}
        </div>
        {settings.templateName ? (
          <iframe
            title="Rechnungsvorlage"
            src={`/api/template?v=${preview}`}
            className="mt-4 h-[480px] w-full rounded-xl border border-border bg-white"
          />
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold">Briefkopf</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {textFields.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                value={draft[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-1.5">
          <Label htmlFor="footer">Schlusstext</Label>
          <Textarea
            id="footer"
            value={footer}
            placeholder="Zusatz unter dem Zahlungsziel"
            onChange={(event) => setFooter(event.target.value)}
          />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card/50 p-4">
        <h2 className="text-sm font-semibold">Sätze</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {numberFields.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                inputMode="decimal"
                value={draft[field.key] ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
              />
              <span className="text-[11px] text-muted-foreground">{field.hint}</span>
            </div>
          ))}
        </div>
      </section>
      <Button className="mt-4 h-10" onClick={() => void save()} disabled={saving}>
        {saving ? <Loader2Icon className="animate-spin" /> : null}
        Speichern
      </Button>
    </div>
  );
}

function toDraft(settings: AppSettings): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of numberFields) {
    draft[field.key] = formatNumber(settings[field.key] as number);
  }
  for (const field of textFields) draft[field.key] = String(settings[field.key] ?? "");
  return draft;
}
