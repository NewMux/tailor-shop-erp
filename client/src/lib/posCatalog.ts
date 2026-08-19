export function getPosAvailabilityLabel(hasInventory: boolean, quantity: number, unit: string): string {
  if (!hasInventory) return "Service";
  return `${Number(quantity || 0).toFixed(2)} ${unit}`;
}

export function getPosCustomerId(customer: { id: number | string } | null | undefined): string {
  return customer ? String(customer.id) : "";
}

export function getPosCustomerLabel(customer: { name?: string | null } | null | undefined): string {
  const name = customer?.name?.trim();
  return name || "Walk-in customer";
}

export function getPosLineKey(item: {
  catalogKey?: string | null;
  sourceLabel: string;
  serviceId?: number | null;
  inventoryItemId?: number | null;
  id: number | string;
}): string {
  return item.catalogKey || `${item.sourceLabel.toLowerCase()}:${item.serviceId || item.inventoryItemId || item.id}`;
}
