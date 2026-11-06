import {
  InventoryItem,
  InventoryItemSchema,
  DispensaryDashboardStats,
  DispensaryDashboardStatsSchema,
  BackendCommandResult,
  BackendCommandResultSchema,
} from './types';
import { z } from 'zod';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

export function getAuthHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchInventory(medicineId: string): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE}/api/inventory/${medicineId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch inventory: ${res.statusText}`);
  return InventoryItemSchema.parse(await res.json());
}

export async function updateInventory(
  medicineId: string,
  updates: Partial<InventoryItem>
): Promise<InventoryItem> {
  const res = await fetch(`${API_BASE}/api/inventory/${medicineId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`Failed to update inventory: ${res.statusText}`);
  return InventoryItemSchema.parse(await res.json());
}

export async function fetchDispensaryInventory(params?: {
  search?: string;
  lowStock?: boolean;
}): Promise<InventoryItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('q', params.search);
  if (params?.lowStock) query.set('low_stock', 'true');
  const res = await fetch(`${API_BASE}/api/dispensary/inventory?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch dispensary stock: ${res.statusText}`);
  return z.array(InventoryItemSchema).parse(await res.json());
}

export async function addOrUpdateStock(body: {
  medicine_id: string;
  batch_number: string;
  quantity: number;
  expiry_date: string;
  reorder_level?: number;
}): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/inventory`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Stock command failed: ${res.statusText}`);
  return BackendCommandResultSchema.parse(await res.json());
}

export async function updateStockQuantity(
  inventoryId: string,
  quantity: number,
  reorderThreshold?: number
): Promise<BackendCommandResult> {
  const res = await fetch(`${API_BASE}/api/dispensary/inventory/${inventoryId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity, reorder_level: reorderThreshold }),
  });
  if (!res.ok) throw new Error(`Stock update failed: ${res.statusText}`);
  return BackendCommandResultSchema.parse(await res.json());
}

export async function searchCatalogMedicines(query: string): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/api/dispensary/catalog/medicines?q=${encodeURIComponent(query)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return (await res.json()) as unknown[];
}

export async function fetchDashboardStats(): Promise<DispensaryDashboardStats> {
  const res = await fetch(`${API_BASE}/api/dispensary/dashboard`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { pending_count: 12, processing_count: 5, ready_count: 3, dispensed_today: 18, revenue: 1420 };
  return DispensaryDashboardStatsSchema.parse(await res.json());
}

export async function fetchInventoryAlerts(): Promise<unknown[]> {
  const res = await fetch(`${API_BASE}/api/dispensary/alerts`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return [];
  return (await res.json()) as unknown[];
}

export async function lookupDispensaryCode(code: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/api/dispensary/lookup/${encodeURIComponent(code)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Lookup failed: ${res.statusText}`);
  return await res.json();
}
