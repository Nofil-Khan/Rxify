/* ─── Rxify Standardized QR & Identifier Protocol ──────────────────────────── */

export type QrTargetType =
  | 'patient'
  | 'doctor'
  | 'hospital'
  | 'dispensary'
  | 'prescription'
  | 'share_token'
  | 'unknown';

export interface ParsedQrPayload {
  type: QrTargetType;
  raw: string;
  id: string; // Cleaned ID or code, e.g. RXF-P-ABCDE, RXF-D-1, 1, tok_123
  numericId?: number;
  label: string;
  metadata?: Record<string, string>;
}

/**
 * Universal parser for any Rxify QR payload, share link, or manual input code.
 */
export function parseQrCode(input: string): ParsedQrPayload {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  // 1. Check for URL format: e.g. https://.../share/{token} or query param
  if (trimmed.includes('/share/')) {
    const parts = trimmed.split('/share/');
    const token = parts[1]?.split('?')[0]?.split('/')[0] ?? '';
    return {
      type: 'share_token',
      raw: trimmed,
      id: token,
      label: `Medical Share Token (${token.slice(0, 8)}...)`,
    };
  }

  // 2. URI schemes: rxify:type:id
  if (upper.startsWith('RXIFY:')) {
    const parts = trimmed.split(':');
    const role = parts[1]?.toLowerCase() as QrTargetType;
    const identifier = parts.slice(2).join(':');
    const num = parseInt(identifier, 10);
    return {
      type: role || 'unknown',
      raw: trimmed,
      id: identifier,
      numericId: !isNaN(num) ? num : undefined,
      label: `${role.toUpperCase()} Identifier: ${identifier}`,
    };
  }

  // 3. Standard Code Prefixes:
  // Patient: RXF-P-XXXXX
  if (upper.startsWith('RXF-P-')) {
    return {
      type: 'patient',
      raw: trimmed,
      id: upper,
      label: `Patient Code: ${upper}`,
    };
  }

  // Doctor: RXF-D-{id} or DOC-{id}
  if (upper.startsWith('RXF-D-') || upper.startsWith('DOC-')) {
    const clean = upper.replace('RXF-D-', '').replace('DOC-', '');
    const num = parseInt(clean, 10);
    return {
      type: 'doctor',
      raw: trimmed,
      id: upper,
      numericId: !isNaN(num) ? num : undefined,
      label: `Doctor Code: ${upper}`,
    };
  }

  // Hospital: RXF-H-{id} or HOSP-{id}
  if (upper.startsWith('RXF-H-') || upper.startsWith('HOSP-')) {
    const clean = upper.replace('RXF-H-', '').replace('HOSP-', '');
    const num = parseInt(clean, 10);
    return {
      type: 'hospital',
      raw: trimmed,
      id: upper,
      numericId: !isNaN(num) ? num : undefined,
      label: `Hospital Code: ${upper}`,
    };
  }

  // Dispensary: RXF-DISP-{id} or DISP-{id}
  if (upper.startsWith('RXF-DISP-') || upper.startsWith('DISP-')) {
    const clean = upper.replace('RXF-DISP-', '').replace('DISP-', '');
    const num = parseInt(clean, 10);
    return {
      type: 'dispensary',
      raw: trimmed,
      id: upper,
      numericId: !isNaN(num) ? num : undefined,
      label: `Dispensary Code: ${upper}`,
    };
  }

  // Prescription: RXF-RX-{id} or RX-{id}
  if (upper.startsWith('RXF-RX-') || upper.startsWith('RX-')) {
    const clean = upper.replace('RXF-RX-', '').replace('RX-', '');
    const num = parseInt(clean, 10);
    return {
      type: 'prescription',
      raw: trimmed,
      id: upper,
      numericId: !isNaN(num) ? num : undefined,
      label: `Prescription #${clean}`,
    };
  }

  // Plain numeric ID
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    return {
      type: 'unknown',
      raw: trimmed,
      id: trimmed,
      numericId: num,
      label: `Numeric ID #${trimmed}`,
    };
  }

  // Fallback
  return {
    type: 'unknown',
    raw: trimmed,
    id: trimmed,
    label: `Code: ${trimmed}`,
  };
}

/**
 * Standardized payload encoder for generating QR data.
 */
export function encodeQrPayload(type: QrTargetType, id: string | number): string {
  const strId = String(id).trim();
  switch (type) {
    case 'patient':
      return strId.startsWith('RXF-P-') ? strId : `RXF-P-${strId}`;
    case 'doctor':
      return strId.startsWith('RXF-D-') ? strId : `RXF-D-${strId}`;
    case 'hospital':
      return strId.startsWith('RXF-H-') ? strId : `RXF-H-${strId}`;
    case 'dispensary':
      return strId.startsWith('RXF-DISP-') ? strId : `RXF-DISP-${strId}`;
    case 'prescription':
      return strId.startsWith('RXF-RX-') ? strId : `RXF-RX-${strId}`;
    case 'share_token':
      return typeof window !== 'undefined'
        ? `${window.location.origin}/share/${strId}`
        : `rxify:share_token:${strId}`;
    default:
      return strId;
  }
}
