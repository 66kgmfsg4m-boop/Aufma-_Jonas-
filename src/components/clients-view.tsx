"use client";

import { requestJson } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/lib/types";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const empty = { name: "", street: "", zip: "", city: "", email: "", phone: "", notes: "" };

export function ClientsView() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    setError("");
    void requestJson<{ clients: Client[] }>("/api/clients")
      .then((data) => setClients(data.clients))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Kunden konnten nicht geladen werden.");
      });
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ clients: Client[] }>("/api/clients")
      .then((data) => {
        if (!cancelled) setClients(data.clients);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Kunden konnten nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function edit(client: Client) {
    setEditing(client.id);
    setForm({
      name: client.name,
      street: client.street,
      zip: client.zip,
      city: client.city,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
    });
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Der Kunde braucht einen Namen.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await requestJson(`/api/clients/${editing}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await requestJson("/api/clients", { method: "POST", body: JSON.stringify(form) });
      }
      setForm(empty);
      setEditing(null);
      load();
      toast.success(editing ? "Kunde geändert" : "Kunde gespeichert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await requestJson(`/api/clients/${id}`, { method: "DELETE" });
      if (editing === id) {
        setEditing(null);
        setForm(empty);
      }
      load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Kunden</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Adressen für Auftrag und Kalender</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ein Kunde, den du an einem Auftrag speicherst, steht hier und lässt sich beim nächsten Auftrag ausfüllen.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
              <p>{error}</p>
              <Button variant="outline" className="mt-3" onClick={load}>
                Erneut laden
              </Button>
            </div>
          ) : clients == null ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
          ) : clients.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-5 py-10">
              <p className="text-lg font-medium">Noch kein Kunde</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Lege den ersten rechts an, oder speichere einen Namen im Auftrag.
              </p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {clients.map((client) => (
                <li key={client.id} className="rounded-xl border border-border bg-card/70 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {[client.street, [client.zip, client.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") ||
                          "ohne Adresse"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[client.email, client.phone].filter(Boolean).join(" · ") || "keine Kontaktdaten"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => edit(client)}>
                        Ändern
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(client.id)}>
                        Löschen
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form
          className="grid h-fit gap-3 rounded-2xl border border-border bg-card/60 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="text-sm font-semibold">{editing ? "Kunde ändern" : "Neuer Kunde"}</h2>
          <Field label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
          <Field label="Straße" value={form.street} onChange={(street) => setForm({ ...form, street })} />
          <div className="grid grid-cols-[6rem_1fr] gap-2">
            <Field label="PLZ" value={form.zip} onChange={(zip) => setForm({ ...form, zip })} />
            <Field label="Ort" value={form.city} onChange={(city) => setForm({ ...form, city })} />
          </div>
          <Field label="E-Mail" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Field label="Telefon" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
          <div className="grid gap-1.5">
            <Label htmlFor="kunde-notiz">Notiz</Label>
            <Textarea id="kunde-notiz" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
            Speichern
          </Button>
          {editing ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
            >
              Abbrechen
            </Button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = `kunde-${label}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
