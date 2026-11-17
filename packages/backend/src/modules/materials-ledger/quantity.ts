import Decimal from "decimal.js";
import { BadRequestError } from "../../lib/errors.ts";

export const MAX_MATERIAL_QUANTITY = 999_999_999_999.99;
export const MATERIAL_QUANTITY_DECIMAL_PLACES = 2;

/** Ledger quantities are numeric(14, 2); reject a value PostgreSQL would round. */
export function validateMaterialQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestError("Quantity must be finite and greater than zero");
  const value = new Decimal(quantity);
  if (value.decimalPlaces() > MATERIAL_QUANTITY_DECIMAL_PLACES) {
    throw new BadRequestError("Material quantities support up to two decimal places. Use a smaller unit and provide its quantity; Panda will not guess a conversion.");
  }
  if (value.greaterThan(MAX_MATERIAL_QUANTITY)) throw new BadRequestError("The material quantity exceeds the ledger limit");
}
