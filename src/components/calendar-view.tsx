"use client";

import { requestJson } from "@/components/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatIsoDate } from "@/lib/format";
import type { CalendarEvent, Client, OrderSummary } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export function CalendarView() {
  const now = berlinMonth();
  const [cursor, setCursor] = useState(now);
  const [selected, setSelected] = useState(berlinDate());
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [orderId, setOrderId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const range = useMemo(() => monthBounds(cursor.year, cursor.month), [cursor]);

  function load() {
    setError("");
    void requestJson<{ events: CalendarEvent[] }>(`/api/events?from=${range.from}&to=${range.to}`)
      .then((data) => setEvents(data.events))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Der Kalender konnte nicht geladen werden.");
      });
  }

  useEffect(() => {
    let cancelled = false;
    void requestJson<{ events: CalendarEvent[] }>(`/api/events?from=${range.from}&to=${range.to}`)
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Der Kalender konnte nicht geladen werden.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to]);

  useEffect(() => {
    void requestJson<{ clients: Client[] }>("/api/clients")
      .then((data) => setClients(data.clients))
      .catch(() => setClients([]));
    void requestJson<{ orders: OrderSummary[] }>("/api/orders")
      .then((data) => setOrders(data.orders))
      .catch(() => setOrders([]));
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events ?? []) {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(() => buildCells(cursor.year, cursor.month), [cursor]);
  const dayEvents = byDay.get(selected) ?? [];

  async function add() {
    if (!title.trim()) {
      toast.error("Der Termin braucht einen Titel.");
      return;
    }
    setSaving(true);
    try {
      await requestJson("/api/events", {
        method: "POST",
        body: JSON.stringify({ date: selected, title, clientId, orderId, notes }),
      });
      setTitle("");
      setNotes("");
      load();
      toast.success("Termin gespeichert");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await requestJson(`/api/events/${id}`, { method: "DELETE" });
      load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Löschen fehlgeschlagen");
    }
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">Kalender</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight capitalize">{monthLabel(cursor.year, cursor.month)}</h1>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" aria-label="Vorheriger Monat" onClick={() => setCursor((value) => shift(value, -1))}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon" aria-label="Nächster Monat" onClick={() => setCursor((value) => shift(value, 1))}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Termine liegen lokal. Kunden aus der Kundenliste kannst du einem Tag zuordnen.
      </p>
      {error ? (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p>{error}</p>
          <Button variant="outline" className="mt-3" onClick={load}>
            Erneut laden
          </Button>
        </div>
      ) : events == null ? (
        <div className="mt-6 h-80 animate-pulse rounded-xl bg-muted/70" />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
              {weekdays.map((day) => (
                <span key={day} className="py-1">
                  {day}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((day, index) =>
                day == null ? (
                  <span key={`empty-${index}`} />
                ) : (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelected(day)}
                    className={`min-h-16 rounded-lg border px-1 py-1 text-left text-sm ${
                      day === selected ? "border-primary bg-primary/15" : "border-border bg-card/60"
                    }`}
                  >
                    <span className="font-mono text-xs">{Number(day.slice(8))}</span>
                    {(byDay.get(day) ?? []).slice(0, 2).map((event) => (
                      <span key={event.id} className="mt-1 block truncate text-[10px] text-primary">
                        {event.title}
                      </span>
                    ))}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <h2 className="text-sm font-semibold">{formatIsoDate(selected)}</h2>
            {dayEvents.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">An diesem Tag ist noch nichts eingetragen.</p>
            ) : (
              <ul className="mt-3 grid gap-2">
                {dayEvents.map((event) => (
                  <li key={event.id} className="rounded-lg border border-border px-3 py-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    {event.clientName ? <p className="text-xs text-muted-foreground">{event.clientName}</p> : null}
                    {event.notes ? <p className="mt-1 text-xs text-muted-foreground">{event.notes}</p> : null}
                    <Button variant="ghost" size="sm" className="mt-1 px-0" onClick={() => void remove(event.id)}>
                      Löschen
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="termin-titel">Titel</Label>
                <Input id="termin-titel" value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="termin-kunde">Kunde</Label>
                <select
                  id="termin-kunde"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                >
                  <option value="">ohne Kunde</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="termin-auftrag">Auftrag</Label>
                <select
                  id="termin-auftrag"
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                  value={orderId}
                  onChange={(event) => setOrderId(event.target.value)}
                >
                  <option value="">ohne Auftrag</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.number} · {order.title}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea value={notes} placeholder="Notiz" aria-label="Notiz" onChange={(event) => setNotes(event.target.value)} />
              <Button onClick={() => void add()} disabled={saving}>
                {saving ? <Loader2Icon className="animate-spin" /> : null}
                Termin speichern
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function berlinDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function berlinMonth(): { year: number; month: number } {
  const today = berlinDate();
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
}

function shift(cursor: { year: number; month: number }, delta: number) {
  const date = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function monthBounds(year: number, month: number) {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number) => String(value).padStart(2, "0");
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

function buildCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= last; day += 1) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

function monthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1, 12)),
  );
}
