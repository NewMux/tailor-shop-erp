export function getPosAvailabilityLabel(hasInventory: boolean, quantity: number, unit: string): string {
  if (!hasInventory) return "Service";
  return `${Number(quantity || 0).toFixed(2)} ${unit}`;
}
