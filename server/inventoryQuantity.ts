export type InventoryQuantityInput = {
  inventoryType: "material" | "item";
  quantity: number | string | null | undefined;
  rollCount: number | string | null | undefined;
  metersPerRoll: number | string | null | undefined;
  hasMovement: boolean;
};

export const rollDerivedQuantity = (
  inventoryType: "material" | "item",
  rollCount: number,
  metersPerRoll?: number,
) => inventoryType === "material" && rollCount > 0 && metersPerRoll && metersPerRoll > 0
  ? rollCount * metersPerRoll
  : null;

export const effectiveInventoryQuantity = ({
  inventoryType,
  quantity,
  rollCount,
  metersPerRoll,
  hasMovement,
}: InventoryQuantityInput) => {
  const currentQuantity = Number(quantity || 0);
  if (currentQuantity !== 0 || hasMovement) return currentQuantity;
  return rollDerivedQuantity(inventoryType, Number(rollCount || 0), Number(metersPerRoll || 0)) ?? currentQuantity;
};
