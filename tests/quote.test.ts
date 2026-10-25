import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildQuote } from "../src/lib/quote.ts";
import { parsePriceCell } from "../src/lib/parse/text.ts";

describe("quote", () => {
  it("adds small parts, travel, labor and VAT", () => {
    const quote = buildQuote({
      material: 100,
      smallPartsOn: true,
      kilometers: 10,
      hours: 2,
      discount: 0,
      deduction: 0,
      markupPercent: 20,
      smallPartsPercent: 5,
      travelEuroPerKm: 0.7,
      hourlyRate: 55,
      vatPercent: 19,
      skontoPercent: 3,
      skontoDays: 14,
      paymentDays: 30,
    });
    assert.equal(quote.smallParts, 5);
    assert.equal(quote.travel, 7);
    assert.equal(quote.labor, 110);
    assert.equal(quote.net, 222);
    assert.equal(quote.vat, 42.18);
    assert.equal(quote.gross, 264.18);
    assert.equal(quote.payable, 264.18);
  });

  it("deducts a net previous payment with its VAT", () => {
    const quote = buildQuote({
      material: 100,
      smallPartsOn: false,
      kilometers: 0,
      hours: 0,
      discount: 0,
      deduction: 50,
      markupPercent: 20,
      smallPartsPercent: 5,
      travelEuroPerKm: 0.7,
      hourlyRate: 55,
      vatPercent: 19,
      skontoPercent: 0,
      skontoDays: 14,
      paymentDays: 30,
    });
    assert.equal(quote.net, 100);
    assert.equal(quote.vat, 19);
    assert.equal(quote.deductionGross, 59.5);
    assert.equal(quote.payable, 59.5);
  });
});

describe("price cells with a glued tax rate", () => {
  it("keeps the euro amount and ignores a bare percent", () => {
    assert.equal(parsePriceCell("23,49 € 19%", true), 23.49);
    assert.equal(parsePriceCell("19%", true), null);
    assert.equal(parsePriceCell("12 Einheiten", true), null);
    assert.equal(parsePriceCell("0,89", true), 0.89);
  });
});
