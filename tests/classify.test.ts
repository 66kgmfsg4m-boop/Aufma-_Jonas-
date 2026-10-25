import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bucketGroups, classifyPart } from "../src/lib/classify.ts";
import { groupParts } from "../src/lib/groups.ts";
import type { Part } from "../src/lib/types.ts";

const cases: [string, string][] = [
  ["Steckklemme WAGO 2273-202, 2-polig", "klemme"],
  ["Jacob 10.1615 PA 7035 PA-Verschlußschraube M16x1,5", "fitting"],
  ["Kaiser 1055-41 Unterputz Gerätedose", "dose"],
  ["KAISER 1555-05 Unterputz-Geräte-Verbindungsdose", "dose"],
  ["Abzweigdose, PVC, 85x44x40mm, IP54", "dose"],
  ["Hohlwanddose winddicht, 60 mm tief", "dose"],
  ["NYM-J 3x1,5 Mantelleitung", "kabel"],
  ["Mantelleitung PVC grau NYM-J 3x1,5mm² 100 Meter", "kabel"],
  ["NYY-J 5x2,5 Erdkabel", "kabel"],
  ["Lapp Kabel 1119303 Ölflex Classic 110 3G1,5 Meterware", "kabel"],
  ["Leitungsschutzschalter B16, 1-polig", "schutz"],
  ["FI-Schutzschalter 40 A, 30 mA, 2-polig", "schutz"],
  ["Hager ADA516D FI/LS Fehlerstrom-Leitungsschutzschalter", "schutz"],
  ["Hager KDN363A Phasenschiene 3-polig", "schutz"],
  ["Kleinhuis HKL2020.3 Kabelkanal reinweiß 18x18mm", "kanal"],
  ["Kabelkanal 60x40 mm mit Deckel", "kanal"],
  ["Fränkische FPKu-EM-F 20 Kunststoffstangenrohr", "rohr"],
  ["Kupferrohr 15x1 mm, Stange 5 m", "rohr"],
  ["Mehrschichtverbundrohr 16x2", "rohr"],
  ["Installationsrohr M20", "rohr"],
  ["HT-Rohr DN 50", "rohr"],
  ["Abdeckrahmen BUSCH-JAEGER 1721-914", "abdeckung"],
  ["Abdeckstreifen F-TRONIC, 12 Einheiten", "abdeckung"],
  ["Hager KZ059 Berührungsschutzabdeckung", "abdeckung"],
  ["Stromstoßschalter ELTAKO S12-100-230 V", "schalter"],
  ["Wippe BUSCH-JAEGER 2506-914", "schalter"],
  ["BUSCH-JAEGER UP-Einsatz, Wippschalter Aus-/Wechsel", "schalter"],
  ["Schutzkontaktsteckdose UP, reinweiß", "schalter"],
  ["Steckdoseneinsatz BUSCH-JAEGER 20 EUC-914", "schalter"],
  ["CEE-Steckdose PCE, 16A, 5-polig", "schalter"],
  ["Schnellbauschraube 3,5x35, Feingewinde", "befestigung"],
  ["Dübel 6x30", "befestigung"],
  ["Gipskartonplatte 12,5 mm", "baustoff"],
  ["OSB-Platte 18 mm", "baustoff"],
  ["Dämmwolle 160 mm", "baustoff"],
  ["Tiefengrund 10 l", "baustoff"],
  ["Acryl-Fugendichtmasse weiß", "baustoff"],
  ["Waschtischarmatur Einhebel", "sanitaer"],
  ["Eckventil 1/2, verchromt", "sanitaer"],
  ["HT-Bogen DN 50, 87 Grad", "fitting"],
  ["Pressfitting Kupplung 16 mm", "fitting"],
];

describe("classify parts", () => {
  for (const [name, expected] of cases) {
    it(`${expected}: ${name}`, () => {
      assert.equal(classifyPart(name), expected);
    });
  }

  it("keeps an unknown part in Sonstiges and orders buckets by trade", () => {
    const groups = groupParts([
      fake("1", "Sonderteil ohne Merkmal"),
      fake("2", "Steckklemme WAGO 221-413"),
      fake("3", "NYM-J 3x1,5 Mantelleitung"),
    ]);
    const buckets = bucketGroups(groups);
    assert.deepEqual(
      buckets.map((bucket) => bucket.category.id),
      ["kabel", "klemme", "sonstiges"],
    );
    assert.equal(buckets[1]?.groups[0]?.name, "Steckklemme WAGO 221-413");
  });
});

function fake(id: string, name: string): Part {
  return {
    id,
    documentId: "d",
    articleNumber: id,
    name,
    unit: "Stk",
    unitPrice: 1,
    quantity: null,
    totalPrice: null,
    priceBasis: 1,
    currency: "EUR",
    supplier: "A",
    docType: "katalog",
    sourceFile: "a.pdf",
    importedAt: "2026-10-06T08:00:00.000Z",
  };
}
