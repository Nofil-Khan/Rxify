import { http, HttpResponse, delay, passthrough } from 'msw';
import { INITIAL_PRESCRIPTIONS, INITIAL_INVENTORY } from './mockDb';
import { Prescription, InventoryItem } from '../types';

let prescriptions: Prescription[] = [...INITIAL_PRESCRIPTIONS];
const inventory: Record<string, InventoryItem> = { ...INITIAL_INVENTORY };

function shouldBypass(): boolean {
  if (typeof window !== 'undefined') {
    return Boolean(localStorage.getItem('rxify_token'));
  }
  return false;
}

export const handlers = [
  // Queue & Prescription Retrieval
  http.get('*/api/pharmacy/prescriptions', async () => {
    if (shouldBypass()) return passthrough();
    await delay(120);
    return HttpResponse.json(prescriptions);
  }),
  http.get('*/api/dispensary/queue', async () => {
    if (shouldBypass()) return passthrough();
    await delay(120);
    return HttpResponse.json(prescriptions);
  }),
  http.get('*/api/dispensary/analytics', async () => {
    if (shouldBypass()) return passthrough();
    await delay(120);
    return HttpResponse.json({
      top_medicines: [
        { medicine_id: 1, generic_name: 'Amoxicillin', brand_name: 'Amoxil', category: 'Antibiotics', strength: '500 mg', form: 'Capsule', total_orders: 142, total_prescribed_qty: 710, total_dispensed_qty: 680, in_stock_qty: 40, reorder_level: 20 },
        { medicine_id: 2, generic_name: 'Paracetamol', brand_name: 'Crocin', category: 'Analgesics', strength: '650 mg', form: 'Tablet', total_orders: 118, total_prescribed_qty: 590, total_dispensed_qty: 570, in_stock_qty: 120, reorder_level: 30 },
        { medicine_id: 3, generic_name: 'Pantoprazole', brand_name: 'Pan 40', category: 'Gastrointestinal', strength: '40 mg', form: 'Tablet', total_orders: 95, total_prescribed_qty: 475, total_dispensed_qty: 450, in_stock_qty: 15, reorder_level: 20 },
        { medicine_id: 4, generic_name: 'Azithromycin', brand_name: 'Zithromax', category: 'Antibiotics', strength: '500 mg', form: 'Tablet', total_orders: 84, total_prescribed_qty: 420, total_dispensed_qty: 395, in_stock_qty: 60, reorder_level: 25 },
        { medicine_id: 5, generic_name: 'Levocetirizine', brand_name: 'Xyzal', category: 'Antihistamines', strength: '5 mg', form: 'Tablet', total_orders: 62, total_prescribed_qty: 310, total_dispensed_qty: 300, in_stock_qty: 85, reorder_level: 20 },
      ],
      categories: [
        { category: 'Antibiotics', item_count: 226, total_quantity: 1130 },
        { category: 'Analgesics', item_count: 118, total_quantity: 590 },
        { category: 'Gastrointestinal', item_count: 95, total_quantity: 475 },
        { category: 'Antihistamines', item_count: 62, total_quantity: 310 },
      ],
      order_trend: [
        { day: '2026-10-31', total_orders: 18, dispensed_orders: 17, cancelled_orders: 1 },
        { day: '2026-11-01', total_orders: 22, dispensed_orders: 20, cancelled_orders: 0 },
        { day: '2026-11-02', total_orders: 25, dispensed_orders: 24, cancelled_orders: 1 },
        { day: '2026-11-03', total_orders: 28, dispensed_orders: 26, cancelled_orders: 0 },
        { day: '2026-11-04', total_orders: 24, dispensed_orders: 23, cancelled_orders: 0 },
        { day: '2026-11-05', total_orders: 31, dispensed_orders: 29, cancelled_orders: 1 },
        { day: '2026-11-06', total_orders: 29, dispensed_orders: 28, cancelled_orders: 0 },
      ],
      kpis: {
        total_orders: 248,
        total_dispensed: 232,
        fulfillment_rate: 94.5,
        avg_prep_time_minutes: 14,
        total_medicines_tracked: 5,
      },
    });
  }),
  http.get('*/api/prescriptions/:id', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(100);
    const rx = prescriptions.find((p) => p.id === params.id);
    return rx ? HttpResponse.json(rx) : new HttpResponse(null, { status: 404 });
  }),
  http.get('*/api/dispensary/requests/:id', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(100);
    const rx = prescriptions.find((p) => p.id === params.id);
    return rx ? HttpResponse.json(rx) : new HttpResponse(null, { status: 404 });
  }),

  // Workflow Commands (5 States)
  http.post('*/api/dispensary/requests/:id/process', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(150);
    const rx = prescriptions.find((p) => p.id === params.id);
    if (rx) rx.status = 'PREPARING';
    return HttpResponse.json({ success: true, message: 'Processing started. Stock reserved.' });
  }),
  http.post('*/api/dispensary/requests/:id/ready', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(150);
    const rx = prescriptions.find((p) => p.id === params.id);
    if (rx) rx.status = 'READY';
    return HttpResponse.json({ success: true, message: 'Prescription packed and marked ready.' });
  }),
  http.post('*/api/dispensary/requests/:id/verify', async () => {
    if (shouldBypass()) return passthrough();
    await delay(150);
    return HttpResponse.json({ success: true, message: 'Patient pickup identity and OTP verified.' });
  }),
  http.post('*/api/dispensary/requests/:id/dispense', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(150);
    const rx = prescriptions.find((p) => p.id === params.id);
    if (rx) {
      rx.status = 'COMPLETED';
      rx.items.forEach((item) => {
        const inv = inventory[item.medicine.id];
        if (inv) inv.available = Math.max(0, inv.available - item.qty);
      });
    }
    return HttpResponse.json({ success: true, message: 'Prescription dispensed and stock deducted.' });
  }),
  http.post('*/api/dispensary/requests/:id/cancel', async ({ params }) => {
    if (shouldBypass()) return passthrough();
    await delay(150);
    const rx = prescriptions.find((p) => p.id === params.id);
    if (rx) rx.status = 'NEW';
    return HttpResponse.json({ success: true, message: 'Request cancelled and reservations released.' });
  }),

  // Item Decisions & AI Clinical Fallback
  http.patch('*/api/dispensary/requests/:id/items/:itemId', async () => {
    await delay(140);
    return HttpResponse.json({ success: true, message: 'Item clinical decision updated.' });
  }),
  http.post('*/api/dispensary/requests/:id/reconsult', async () => {
    await delay(140);
    return HttpResponse.json({ success: true, message: 'Reconsultation notice sent to physician.' });
  }),
  http.post('*/api/dispensary/requests/:id/ai-resolve', async () => {
    await delay(200);
    return HttpResponse.json({ success: true, message: 'Gemini AI resolved medication substitutes.' });
  }),

  // Inventory & Stock Management
  http.get('*/api/inventory/:medicineId', async ({ params }) => {
    await delay(100);
    const item = inventory[params.medicineId as string] ?? {
      medicineId: params.medicineId,
      available: 40,
      reserved: 10,
      reorderLevel: 20,
      batches: [{ batchNumber: 'BAT-2026-X1', expiryDate: '2028-12-31', quantity: 40 }],
    };
    return HttpResponse.json(item);
  }),
  http.patch('*/api/inventory/:medicineId', async ({ params, request }) => {
    await delay(140);
    const updates = (await request.json()) as Partial<InventoryItem>;
    const id = params.medicineId as string;
    const item = inventory[id] ?? { medicineId: id, available: 40, reserved: 10, reorderLevel: 20, batches: [] };
    Object.assign(item, updates);
    inventory[id] = item;
    return HttpResponse.json(item);
  }),
  http.get('*/api/dispensary/inventory', async () => {
    await delay(120);
    return HttpResponse.json(Object.values(inventory));
  }),
  http.post('*/api/dispensary/inventory', async () => {
    await delay(150);
    return HttpResponse.json({ success: true, message: 'Stock and batch successfully added.' });
  }),
  http.get('*/api/dispensary/catalog/medicines', async () => {
    await delay(120);
    return HttpResponse.json([
      { medicine_id: 1, name: 'Amoxicillin', generic_name: 'Amoxicillin Trihydrate', strength: '500 mg', form: 'Capsule' },
      { medicine_id: 2, name: 'Paracetamol', generic_name: 'Acetaminophen', strength: '650 mg', form: 'Tablet' },
      { medicine_id: 3, name: 'Pantoprazole', generic_name: 'Pantoprazole Sodium', strength: '40 mg', form: 'Tablet' },
    ]);
  }),

  // Dashboard Telemetry & Alerts
  http.get('*/api/dispensary/dashboard', async () => {
    await delay(100);
    return HttpResponse.json({ pending_count: 12, processing_count: 5, ready_count: 3, dispensed_today: 18, revenue: 1420 });
  }),
  http.get('*/api/dispensary/alerts', async () => {
    await delay(100);
    return HttpResponse.json([
      { inventory_id: 1, medicine_name: 'Pantoprazole', available_quantity: 0, status: 'OUT_OF_STOCK' },
      { inventory_id: 2, medicine_name: 'Paracetamol', available_quantity: 5, status: 'LOW_STOCK' },
    ]);
  }),
  http.get('*/api/dispensary/lookup/:code', async ({ params }) => {
    await delay(100);
    return HttpResponse.json({ success: true, code: params.code, type: 'PRESCRIPTION', verified: true });
  }),
  http.post('*/api/prescriptions/:id/transition', async ({ params, request }) => {
    await delay(150);
    const body = (await request.json()) as { targetStatus: Prescription['status'] };
    const rx = prescriptions.find((p) => p.id === params.id);
    if (!rx) return new HttpResponse(null, { status: 404 });
    rx.status = body.targetStatus;
    return HttpResponse.json(rx);
  }),
];

export function insertMockPrescription(newRx: Prescription) {
  prescriptions = [newRx, ...prescriptions];
}
