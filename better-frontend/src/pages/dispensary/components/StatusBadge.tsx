/** Dispensary-specific status badges — request status, match status, stock status */

type MatchStatus = 'MATCHED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NOT_A_MEDICINE' | null | undefined;
type AvailStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'AMBIGUOUS' | 'UNRESOLVED' | 'NOT_A_MEDICINE' | null | undefined;
type RequestStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'DISPENSED' | 'CANCELLED' | null | undefined;
type StockStatus = 'NORMAL' | 'LOW_STOCK' | 'OUT_OF_STOCK' | null | undefined;

const REQUEST_BADGE: Record<string, string> = {
  PENDING:             'disp-badge--pending',
  PROCESSING:          'disp-badge--processing',
  READY:               'disp-badge--ready',
  DISPENSED:           'disp-badge--dispensed',
  CANCELLED:           'disp-badge--cancelled',
  PARTIALLY_AVAILABLE: 'disp-badge--partial',
  UNAVAILABLE:         'disp-badge--unavailable',
};

const REQUEST_LABEL: Record<string, string> = {
  PENDING:             'Pending',
  PROCESSING:          'Processing',
  READY:               'Ready',
  DISPENSED:           'Dispensed',
  CANCELLED:           'Cancelled',
  PARTIALLY_AVAILABLE: 'Partial',
  UNAVAILABLE:         'Unavailable',
};

const MATCH_BADGE: Record<string, string> = {
  MATCHED:       'disp-badge--matched',
  AMBIGUOUS:     'disp-badge--ambiguous',
  UNRESOLVED:    'disp-badge--unresolved',
  NOT_A_MEDICINE:'disp-badge--not-med',
};

const MATCH_LABEL: Record<string, string> = {
  MATCHED:       'Matched',
  AMBIGUOUS:     'Ambiguous',
  UNRESOLVED:    'Unresolved',
  NOT_A_MEDICINE:'Not a medicine',
};

const AVAIL_BADGE: Record<string, string> = {
  AVAILABLE:     'disp-badge--available',
  PARTIAL:       'disp-badge--partial',
  UNAVAILABLE:   'disp-badge--unavailable',
  AMBIGUOUS:     'disp-badge--ambiguous',
  UNRESOLVED:    'disp-badge--unresolved',
  NOT_A_MEDICINE:'disp-badge--not-med',
};

const AVAIL_LABEL: Record<string, string> = {
  AVAILABLE:     'Available',
  PARTIAL:       'Partial',
  UNAVAILABLE:   'Unavailable',
  AMBIGUOUS:     'Ambiguous',
  UNRESOLVED:    'Unresolved',
  NOT_A_MEDICINE:'Not a medicine',
};

const STOCK_BADGE: Record<string, string> = {
  NORMAL:      'disp-badge--normal',
  LOW_STOCK:   'disp-badge--low',
  OUT_OF_STOCK:'disp-badge--out',
};

const STOCK_LABEL: Record<string, string> = {
  NORMAL:      'In Stock',
  LOW_STOCK:   'Low Stock',
  OUT_OF_STOCK:'Out of Stock',
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  if (!status) return null;
  return (
    <span className={`disp-badge ${REQUEST_BADGE[status] ?? 'disp-badge--neutral'}`}>
      {REQUEST_LABEL[status] ?? status}
    </span>
  );
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  if (!status) return null;
  return (
    <span className={`disp-badge ${MATCH_BADGE[status] ?? 'disp-badge--neutral'}`}>
      {MATCH_LABEL[status] ?? status}
    </span>
  );
}

export function AvailStatusBadge({ status }: { status: AvailStatus }) {
  if (!status) return null;
  return (
    <span className={`disp-badge ${AVAIL_BADGE[status] ?? 'disp-badge--neutral'}`}>
      {AVAIL_LABEL[status] ?? status}
    </span>
  );
}

export function StockStatusBadge({ status }: { status: StockStatus }) {
  if (!status) return null;
  return (
    <span className={`disp-badge ${STOCK_BADGE[status] ?? 'disp-badge--neutral'}`}>
      {STOCK_LABEL[status] ?? status}
    </span>
  );
}
