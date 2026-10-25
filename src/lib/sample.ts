import { importDocument, type IncomingPart } from "@/lib/db";
import type { DocType } from "@/lib/types";

type SampleDoc = {
  id: string;
  filename: string;
  supplier: string;
  docType: DocType;
  uploadedAt: string;
  items: IncomingPart[];
};

function line(
  articleNumber: string,
  name: string,
  unit: string,
  unitPrice: number,
  quantity: number | null = null,
): IncomingPart {
  return {
    articleNumber,
    name,
    unit,
    unitPrice,
    quantity,
    totalPrice: quantity == null ? null : Math.round(unitPrice * quantity * 100) / 100,
    priceBasis: 1,
  };
}

const documents: SampleDoc[] = [
  {
    id: "sample-elektro-katalog",
    filename: "Elektro-Wagner-Katalog.xlsx",
    supplier: "Elektro Wagner",
    docType: "katalog",
    uploadedAt: "2026-03-02T08:30:00.000Z",
    items: [
      line("NYM-J315", "NYM-J 3x1,5 Mantelleitung", "m", 0.89),
      line("NYM-J325", "NYM-J 3x2,5 Mantelleitung", "m", 1.28),
      line("NYM-J525", "NYM-J 5x2,5 Mantelleitung", "m", 2.14),
      line("NYY-J525", "NYY-J 5x2,5 Erdkabel", "m", 3.45),
      line("DOS-60", "Hohlwanddose winddicht, 60 mm tief", "Stk", 0.42),
      line("LS-B16", "Leitungsschutzschalter B16, 1-polig", "Stk", 4.85),
      line("FI-4030", "FI-Schutzschalter 40 A, 30 mA, 2-polig", "Stk", 28.9),
      line("KAN-6040", "Kabelkanal 60x40 mm mit Deckel", "m", 3.2),
      line("STD-UP", "Schutzkontaktsteckdose UP, reinweiß", "Stk", 4.4),
      line("ABD-70", "Abzweigdose 70 mm, IP54", "Stk", 1.15),
    ],
  },
  {
    id: "sample-elektro-rechnung",
    filename: "Rechnung-48219-Elektro-Wagner.pdf",
    supplier: "Elektro Wagner",
    docType: "rechnung",
    uploadedAt: "2026-09-18T07:15:00.000Z",
    items: [
      line("NYM-J315", "NYM-J 3x1,5 Mantelleitung", "m", 0.97, 180),
      line("LS-B16", "Leitungsschutzschalter B16, 1-polig", "Stk", 5.4, 12),
      line("DOS-60", "Hohlwanddose winddicht, 60 mm tief", "Stk", 0.48, 80),
      line("FI-4030", "FI-Schutzschalter 40 A, 30 mA, 2-polig", "Stk", 31.2, 3),
      line("KAN-6040", "Kabelkanal 60x40 mm mit Deckel", "m", 3.55, 40),
    ],
  },
  {
    id: "sample-shk-katalog",
    filename: "SHK-Nord-Preisliste.xlsx",
    supplier: "SHK Nord",
    docType: "katalog",
    uploadedAt: "2026-04-11T09:00:00.000Z",
    items: [
      line("CU-15", "Kupferrohr 15x1 mm, Stange 5 m", "m", 6.7),
      line("MV-16", "Mehrschichtverbundrohr 16x2", "m", 1.35),
      line("MV-20", "Mehrschichtverbundrohr 20x2", "m", 1.85),
      line("EV-12", "Eckventil 1/2, verchromt", "Stk", 7.2),
      line("HT-50", "HT-Rohr DN 50, Baulänge 250 mm", "Stk", 2.1),
      line("HTB-50", "HT-Bogen DN 50, 87 Grad", "Stk", 1.05),
      line("PF-16", "Pressfitting Kupplung 16 mm", "Stk", 2.8),
      line("ARM-WT", "Waschtischarmatur Einhebel, chrom", "Stk", 86),
    ],
  },
  {
    id: "sample-bau-katalog",
    filename: "Bauzentrum-Holt-Katalog.csv",
    supplier: "Bauzentrum Holt",
    docType: "katalog",
    uploadedAt: "2026-01-20T10:45:00.000Z",
    items: [
      line("GKP-125", "Gipskartonplatte 12,5 mm, imprägniert", "m²", 4.6),
      line("OSB-18", "OSB-Platte 18 mm, Nut und Feder", "m²", 9.8),
      line("DWE-160", "Dämmwolle 160 mm, WLG 035", "m²", 8.25),
      line("SCH-200", "Schalungsbrett 24x200 mm, sägerau", "m", 3.15),
      line("BET-C25", "Transportbeton C25/30", "m³", 148),
      line("SBS-35", "Schnellbauschraube 3,5x35, Feingewinde", "Stk", 0.018),
      line("TGR-10", "Tiefengrund 10 l", "Stk", 24.5),
      line("ACR-W", "Acryl-Fugendichtmasse weiß, 310 ml", "Stk", 3.1),
    ],
  },
];

export function installSampleLibrary(): { documents: number; parts: number } {
  let parts = 0;
  for (const document of documents) {
    const saved = importDocument(document);
    parts += saved.itemCount;
  }
  return { documents: documents.length, parts };
}
