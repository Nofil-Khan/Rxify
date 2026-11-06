import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Prescription } from '../types';
import { insertMockPrescription } from '../mocks/handlers';

const LIVE_PATIENTS = [
  { name: 'Aditya Rao', age: 34, gender: 'Male' as const, initials: 'AR', diag: 'Acute Pharyngitis', med: 'Azithromycin 500mg' },
  { name: 'Meera Nair', age: 29, gender: 'Female' as const, initials: 'MN', diag: 'Seasonal Rhinitis', med: 'Levocetirizine 5mg' },
  { name: 'Karan Mehra', age: 41, gender: 'Male' as const, initials: 'KM', diag: 'Bronchial Spasm', med: 'Budesonide Inhaler' },
];

export function useMockWebSocket() {
  const queryClient = useQueryClient();
  const counterRef = React.useRef(1050);

  React.useEffect(() => {
    // Only run mock WS simulation when unauthenticated demo mode (not calling real FastAPI)
    const token = typeof window !== 'undefined' ? localStorage.getItem('rxify_token') : null;
    if (import.meta.env.VITE_API_BASE_URL || token) return;

    const interval = setInterval(() => {
      counterRef.current += 1;
      const seed = LIVE_PATIENTS[counterRef.current % LIVE_PATIENTS.length];
      const newRx: Prescription = {
        id: `rx-${counterRef.current}`,
        rxNumber: `RX-2026-${counterRef.current}`,
        status: 'NEW',
        createdAt: new Date().toISOString(),
        timeAgo: 'Just now',
        flagged: false,
        patient: {
          id: `p-${counterRef.current}`,
          name: seed.name,
          age: seed.age,
          gender: seed.gender,
          initials: seed.initials,
        },
        doctor: { id: 'd-live', name: 'Dr. Neha Kapoor', specialty: 'General Medicine' },
        diagnosis: seed.diag,
        notes: 'Dispense urgent starter dose. Verify allergy history.',
        items: [
          {
            medicine: { id: `med-live-${counterRef.current}`, name: seed.med, strength: 'Standard', form: 'Tablet' },
            qty: 10,
            inStock: 25,
          },
        ],
      };

      insertMockPrescription(newRx);

      queryClient.setQueryData<Prescription[]>(['prescriptions'], (old = []) => [
        newRx,
        ...old,
      ]);
    }, 45000);

    return () => clearInterval(interval);
  }, [queryClient]);
}

