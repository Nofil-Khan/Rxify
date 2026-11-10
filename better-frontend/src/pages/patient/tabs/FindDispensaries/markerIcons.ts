import L from 'leaflet';
import type { DispensaryAvailabilityStatus } from '../../../../lib/patientApi';

export function createDispensaryMarker(
  status?: DispensaryAvailabilityStatus,
  isSelected: boolean = false
): L.DivIcon {
  let fillColor = '#0284c7'; // default blue
  let strokeColor = '#0369a1';

  if (status === 'ALL_AVAILABLE') {
    fillColor = '#10b981'; // emerald green
    strokeColor = '#047857';
  } else if (status === 'PARTIALLY_AVAILABLE') {
    fillColor = '#f59e0b'; // amber
    strokeColor = '#b45309';
  } else if (status === 'NONE_AVAILABLE') {
    fillColor = '#ef4444'; // rose/red
    strokeColor = '#b91c1c';
  } else if (status === 'AVAILABILITY_UNKNOWN') {
    fillColor = '#8b5cf6'; // purple
    strokeColor = '#6d28d9';
  }

  const scale = isSelected ? 1.25 : 1.0;
  const filter = isSelected
    ? 'drop-shadow(0 0 10px rgba(14, 165, 233, 0.8))'
    : 'drop-shadow(0 3px 6px rgba(0,0,0,0.35))';

  return L.divIcon({
    className: 'rx-leaflet-marker',
    iconSize: [36 * scale, 44 * scale],
    iconAnchor: [18 * scale, 44 * scale],
    popupAnchor: [0, -42 * scale],
    html: `
      <div style="
        position: relative;
        width: ${36 * scale}px;
        height: ${44 * scale}px;
        filter: ${filter};
        cursor: pointer;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      ">
        <svg width="${36 * scale}" height="${44 * scale}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.47715 2 2 6.47715 2 12C2 18.5 12 27 12 27C12 27 22 18.5 22 12C22 6.47715 17.5228 2 12 2Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="#ffffff"/>
          <path d="M12 8.5V13.5M9.5 11H14.5" stroke="${strokeColor}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
  });
}

export function createUserLocationMarker(): L.DivIcon {
  return L.divIcon({
    className: 'rx-user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.35);
          animation: rx-pulse 2s infinite ease-out;
        "></div>
        <div style="
          position: relative;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #0284c7;
          border: 2.5px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
  });
}

export function getAvailabilityBadgeHtml(
  status?: DispensaryAvailabilityStatus,
  availCount: number = 0,
  totalCount: number = 0
): string {
  if (status === 'ALL_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #047857;">ALL IN STOCK (${availCount}/${totalCount})</div>`;
  }
  if (status === 'PARTIALLY_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(245, 158, 11, 0.15); color: #b45309;">PARTIAL STOCK (${availCount}/${totalCount})</div>`;
  }
  if (status === 'NONE_AVAILABLE') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(239, 68, 68, 0.15); color: #b91c1c;">OUT OF STOCK (0/${totalCount})</div>`;
  }
  if (status === 'AVAILABILITY_UNKNOWN') {
    return `<div style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; background: rgba(139, 92, 246, 0.15); color: #6d28d9;">CLARIFICATION NEEDED</div>`;
  }
  return '';
}

