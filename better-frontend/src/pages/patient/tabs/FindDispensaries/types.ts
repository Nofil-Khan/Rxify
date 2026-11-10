import type {
  NearbyDispensary,
  Prescription,
  PatientDispensaryRequest,
} from '../../../../lib/patientApi';

export interface FindDispensariesTabProps {
  initialPrescriptionId?: number | null;
  activeRequests?: PatientDispensaryRequest[];
  onOrderSuccess?: () => void;
  onNavigateToDispensaryStatus?: () => void;
}

export interface SearchSuggestion {
  place_id: number | string;
  display_name: string;
  lat: string;
  lon: string;
}

export type StockFilter = 'ALL' | 'TOP_3' | 'FULL_STOCK';

export interface ToastAlert {
  message: string;
  type: 'success' | 'error';
}

