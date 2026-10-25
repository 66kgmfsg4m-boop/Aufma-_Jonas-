import { addDays, formatEuro, formatIsoDate, formatNumber } from "@/lib/format";
import type { InvoiceModel } from "@/lib/types";

export function InvoiceSheet({ model }: { model: InvoiceModel }) {
  const quote = model.quote;
  const due = addDays(model.date, quote.paymentDays);
  const skontoUntil = quote.skontoPercent > 0 ? addDays(model.date, quote.skontoDays) : "";
  const cityLine = [model.zip, model.city].filter(Boolean).join(" ");
  const sender = [model.companyName, model.companyStreet, [model.companyZip, model.companyCity].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="invoice-sheet mx-auto max-w-3xl rounded-xl bg-[#f4efe4] px-6 py-8 text-[#231e18] shadow-xl md:px-10 md:py-10">
      <header className="flex flex-col gap-6 border-b border-[#231e18]/15 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {sender ? <p className="text-[11px] text-[#231e18]/60">{sender}</p> : null}
          <div className="mt-6 text-sm leading-6">
            {model.customer ? <p className="font-medium">{model.customer}</p> : <p>Kunde</p>}
            {model.street ? <p>{model.street}</p> : null}
            {cityLine ? <p>{cityLine}</p> : null}
          </div>
        </div>
        <div className="text-sm leading-6 sm:text-right">
          {model.companyName ? <p className="text-base font-semibold">{model.companyName}</p> : <p className="font-semibold">Rechnung</p>}
          {model.companyStreet ? <p>{model.companyStreet}</p> : null}
          {[model.companyZip, model.companyCity].filter(Boolean).join(" ") ? (
            <p>{[model.companyZip, model.companyCity].filter(Boolean).join(" ")}</p>
          ) : null}
          {model.companyPhone ? <p>{model.companyPhone}</p> : null}
          {model.companyEmail ? <p>{model.companyEmail}</p> : null}
          {model.taxNumber ? <p>St.-Nr. {model.taxNumber}</p> : null}
          {model.vatId ? <p>USt-IdNr. {model.vatId}</p> : null}
        </div>
      </header>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-[#8a5a12] uppercase">Rechnung</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{model.number}</h1>
          {model.title ? <p className="mt-1 text-sm">Kommission {model.title}</p> : null}
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
          <dt className="text-[#231e18]/70">Datum</dt>
          <dd>{formatIsoDate(model.date)}</dd>
          {model.serviceDate ? (
            <>
              <dt className="text-[#231e18]/70">Leistung</dt>
              <dd>{formatIsoDate(model.serviceDate)}</dd>
            </>
          ) : null}
          {model.phone ? (
            <>
              <dt className="text-[#231e18]/70">Telefon</dt>
              <dd>{model.phone}</dd>
            </>
          ) : null}
          {model.email ? (
            <>
              <dt className="text-[#231e18]/70">E-Mail</dt>
              <dd>{model.email}</dd>
            </>
          ) : null}
        </dl>
      </div>
      {model.lines.length === 0 && model.extras.length === 0 ? (
        <p className="py-10 text-sm">Dieser Auftrag hat noch keine Positionen.</p>
      ) : (
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-[#231e18]/20 text-left text-[11px] tracking-[0.12em] uppercase">
              <th className="py-2 pr-2 font-medium">Position</th>
              <th className="py-2 pr-2 font-medium">Menge</th>
              <th className="py-2 pr-2 font-medium">Bezeichnung</th>
              <th className="py-2 pr-2 text-right font-medium">Einzelpreis</th>
              <th className="py-2 text-right font-medium">Gesamtpreis</th>
            </tr>
          </thead>
          <tbody>
            {model.title ? (
              <tr>
                <td colSpan={5} className="pt-3 pb-1 text-xs font-semibold tracking-[0.08em] uppercase">
                  {model.title}
                </td>
              </tr>
            ) : null}
            {model.lines.map((line) => (
              <tr key={`${line.position}-${line.articleNumber}`} className="border-b border-[#231e18]/10 align-top">
                <td className="py-3 pr-2 font-mono text-xs">{line.position}</td>
                <td className="py-3 pr-2 tabular-nums">
                  {formatNumber(line.quantity)}
                  {line.unit ? ` ${line.unit}` : ""}
                </td>
                <td className="py-3 pr-2">
                  <span className="block">{line.name}</span>
                  {line.articleNumber ? <span className="text-xs text-[#231e18]/70">{line.articleNumber}</span> : null}
                </td>
                <td className="py-3 pr-2 text-right tabular-nums">{formatEuro(line.unitSell)}</td>
                <td className="py-3 text-right font-medium tabular-nums">{formatEuro(line.lineTotal)}</td>
              </tr>
            ))}
            {model.extras.map((extra) => (
              <tr key={extra.label} className="border-b border-[#231e18]/10 align-top">
                <td className="py-3 pr-2 font-mono text-xs" />
                <td className="py-3 pr-2 tabular-nums">
                  {formatNumber(extra.quantity)} {extra.unit}
                </td>
                <td className="py-3 pr-2">
                  <span className="block">{extra.label}</span>
                  <span className="text-xs text-[#231e18]/70">{extra.detail}</span>
                </td>
                <td className="py-3 pr-2 text-right tabular-nums">{formatEuro(extra.unitPrice)}</td>
                <td className="py-3 text-right font-medium tabular-nums">{formatEuro(extra.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-6 ml-auto grid max-w-sm gap-1 text-sm">
        <Sum
          label={quote.discount > 0 ? "Summe" : "Summe Netto"}
          value={Math.round((quote.material + quote.smallParts + quote.travel + quote.labor) * 100) / 100}
        />
        {quote.discount > 0 ? <Sum label="Nachlass" value={-quote.discount} /> : null}
        {quote.discount > 0 ? <Sum label="Summe Netto" value={quote.net} /> : null}
        <Sum label={`MwSt ${formatNumber(quote.vatPercent)} %`} value={quote.vat} />
        <Sum label="Summe Brutto" value={quote.gross} />
        {quote.deductionGross > 0 ? <Sum label="Abschlag" value={-quote.deductionGross} /> : null}
        <p className="mt-2 flex items-baseline justify-between gap-4 border-t border-[#231e18]/20 pt-3">
          <span className="tracking-[0.12em] uppercase">{quote.deductionGross > 0 ? "Restforderung" : "Zahlbetrag"}</span>
          <span className="font-mono text-2xl tabular-nums">{formatEuro(quote.payable)}</span>
        </p>
      </div>
      <div className="mt-8 space-y-2 text-sm leading-relaxed">
        {quote.skontoPercent > 0 ? (
          <p>
            Bei Zahlung bis {formatIsoDate(skontoUntil)} ({quote.skontoDays} Tage) gewähren wir {formatNumber(quote.skontoPercent)} % Skonto.
          </p>
        ) : null}
        <p>Zahlbar ohne Abzug bis {formatIsoDate(due)}.</p>
        {model.bank ? <p>{model.bank}</p> : null}
        {model.footer ? <p className="whitespace-pre-wrap">{model.footer}</p> : null}
      </div>
    </article>
  );
}

function Sum({ label, value }: { label: string; value: number }) {
  return (
    <p className="flex items-baseline justify-between gap-4">
      <span>{label}</span>
      <span className="tabular-nums">{formatEuro(value)}</span>
    </p>
  );
}
