import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
import {
  processRequestCommand,
  markReadyCommand,
  verifyPickupCommand,
  dispenseRequestCommand,
  cancelRequestCommand,
  updateItemDecisionCommand,
  reconsultDoctorCommand,
  aiResolveRequestCommand,
  fetchDispensaryInventory,
  addOrUpdateStock,
  fetchDashboardStats,
  fetchInventoryAlerts,
} from './api';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Dispensary Backend Commands API', () => {
  it('executes processRequestCommand and reserves stock', async () => {
    const res = await processRequestCommand('rx-1042');
    expect(res.success).toBe(true);
    expect(res.message).toContain('Processing started');
  });

  it('executes markReadyCommand and sets request ready for pickup', async () => {
    const res = await markReadyCommand('rx-1042');
    expect(res.success).toBe(true);
    expect(res.message).toContain('marked ready');
  });

  it('executes verifyPickupCommand with patient code OTP', async () => {
    const res = await verifyPickupCommand('rx-1042', '849201');
    expect(res.success).toBe(true);
    expect(res.message).toContain('verified');
  });

  it('executes dispenseRequestCommand and completes fulfillment', async () => {
    const res = await dispenseRequestCommand('rx-1042', '849201');
    expect(res.success).toBe(true);
    expect(res.message).toContain('dispensed');
  });

  it('executes cancelRequestCommand and releases reservations', async () => {
    const res = await cancelRequestCommand('rx-1042', 'Patient cancelled pickup');
    expect(res.success).toBe(true);
    expect(res.message).toContain('cancelled');
  });

  it('executes updateItemDecisionCommand for medication substitution', async () => {
    const res = await updateItemDecisionCommand('rx-1042', 'med-panto', 'SUBSTITUTE', 5, 'Omeprazole 20mg');
    expect(res.success).toBe(true);
  });

  it('executes reconsultDoctorCommand for prescribing doctor query', async () => {
    const res = await reconsultDoctorCommand('rx-1042', 'Alternative formulation approval needed', true);
    expect(res.success).toBe(true);
    expect(res.message).toContain('Reconsultation');
  });

  it('executes aiResolveRequestCommand using Gemini fallback', async () => {
    const res = await aiResolveRequestCommand('rx-1042');
    expect(res.success).toBe(true);
    expect(res.message).toContain('AI');
  });

  it('fetches inventory, dashboard stats, and alerts telemetry', async () => {
    const inv = await fetchDispensaryInventory();
    expect(Array.isArray(inv)).toBe(true);

    const stats = await fetchDashboardStats();
    expect(stats.pending_count).toBe(12);

    const alerts = await fetchInventoryAlerts();
    expect(Array.isArray(alerts)).toBe(true);
  });

  it('executes addOrUpdateStock command for inventory management', async () => {
    const res = await addOrUpdateStock({
      medicine_id: 'med-amox',
      batch_number: 'BAT-2026-X2',
      quantity: 50,
      expiry_date: '2028-12-31',
      reorder_level: 20,
    });
    expect(res.success).toBe(true);
  });
});
