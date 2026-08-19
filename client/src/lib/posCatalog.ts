export function getPosAvailabilityLabel(hasInventory: boolean, quantity: number, unit: string): string {
  if (!hasInventory) return "Service";
  return `${Number(quantity || 0).toFixed(2)} ${unit}`;
}

export function getPosCustomerLabel(customer: { name?: string | null } | null | undefined): string {
  const name = customer?.name?.trim();
  return name || "Walk-in customer";
}
