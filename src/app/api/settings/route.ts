import { getSettings, saveSettings } from "@/lib/settings";
import { asNumber, asText } from "@/lib/sanitize";
import type { AppSettings } from "@/lib/types";

export async function GET() {
  return Response.json({ settings: getSettings() });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Die Daten sind unvollständig." }, { status: 400 });
  const patch: Partial<AppSettings> = {};
  const numbers: (keyof AppSettings)[] = [
    "markupPercent",
    "smallPartsPercent",
    "travelEuroPerKm",
    "hourlyRate",
    "vatPercent",
    "skontoPercent",
    "skontoDays",
    "paymentDays",
  ];
  for (const key of numbers) {
    if (body[key] != null) (patch[key] as number) = asNumber(body[key]);
  }
  const texts: (keyof AppSettings)[] = [
    "companyName",
    "companyStreet",
    "companyZip",
    "companyCity",
    "companyPhone",
    "companyEmail",
    "taxNumber",
    "vatId",
    "bank",
    "footer",
    "templateName",
  ];
  for (const key of texts) {
    if (typeof body[key] !== "string") continue;
    (patch[key] as string) = key === "footer" ? body[key].trim().slice(0, 800) : asText(body[key], 400);
  }
  return Response.json({ settings: saveSettings(patch) });
}
