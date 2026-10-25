import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupParts } from "../src/lib/groups.ts";
import { lineTotal, sellPrice } from "../src/lib/pricing.ts";
import type { Part } from "../src/lib/types.ts";

function part(overrides: Partial<Part>): Part {
  return {
    id: "1",
    documentId: "d",
    articleNumber: "",
    name: "",
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
    ...overrides,
  };
}

describe("sell price", () => {
  it("adds 20 percent and keeps cents", () => {
    assert.equal(sellPrice(10), 12);
    assert.equal(sellPrice(0.89), 1.068);
    assert.equal(sellPrice(0.65), 0.78);
    assert.equal(sellPrice(13.55), 16.26);
    assert.equal(lineTotal(1.068, 10), 10.68);
  });
});

describe("part groups", () => {
  it("collapses the same article number and keeps the cheapest offer first", () => {
    const groups = groupParts([
      part({ id: "a", articleNumber: "NYM-J315", name: "NYM kurz", unitPrice: 0.97, supplier: "Rechnung" }),
      part({ id: "b", articleNumber: "nym-j315", name: "NYM-J 3x1,5 Mantelleitung", unitPrice: 0.89, supplier: "Katalog" }),
      part({ id: "c", articleNumber: "", name: "Sonderteil", unitPrice: 4 }),
    ]);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.offers.length, 2);
    assert.equal(groups[0]?.offers[0]?.id, "b");
    assert.equal(groups[0]?.name, "NYM-J 3x1,5 Mantelleitung");
    assert.equal(groups[1]?.offers.length, 1);
    assert.equal(groups[1]?.articleNumber, "");
  });
});
