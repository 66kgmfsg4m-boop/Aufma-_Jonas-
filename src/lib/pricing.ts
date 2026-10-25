export const MARKUP = 0.2;

export function sellPrice(cost: number): number {
  return Math.round(cost * (1 + MARKUP) * 10000) / 10000;
}

export function lineTotal(unitSell: number, quantity: number): number {
  return Math.round(unitSell * quantity * 100) / 100;
}
