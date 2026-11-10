import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  dispensaryName?: string;
}

function createPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'rx-dispensary-map-pin',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -42],
    html: `
      <div style="position:relative;width:36px;height:44px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));cursor:grab;">
        <svg width="36" height="44" viewBox="0 0 24 28" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 18.5 12 27 12 27C12 27 22 18.5 22 12C22 6.48 17.52 2 12 2Z" fill="#4A7C6F" stroke="#2D5A4E" stroke-width="1.5"/>
          <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
          <path d="M12 8.5V13.5M9.5 11H14.5" stroke="#4A7C6F" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    `,
  });
}

/** Interactive Leaflet map with 25km patient radar circle & draggable pin. */
const InteractiveMap: React.FC<Props> = ({ lat, lng, onChange, dispensaryName = 'Dispensary' }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  const circleRef = React.useRef<L.Circle | null>(null);

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], {
      icon: createPinIcon(),
      draggable: true,
    }).addTo(map);

    marker.bindPopup(`<strong>${dispensaryName}</strong><br/><span style="font-size:11px;">Drag pin to calibrate GPS location</span>`);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(e.latlng.lat, e.latlng.lng);
    });

    // 25km radius patient discovery circle
    const circle = L.circle([lat, lng], {
      radius: 25000,
      color: '#4A7C6F',
      fillColor: '#4A7C6F',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '5, 8',
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    setTimeout(() => map.invalidateSize(), 150);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync external coordinates
  React.useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - lat) > 0.0001 || Math.abs(current.lng - lng) > 0.0001) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapRef.current.panTo([lat, lng], { animate: true });
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-[320px] rounded-2xl overflow-hidden" style={{ border: '1px solid var(--ti-hairline)' }}>
      <div ref={containerRef} className="w-full h-full" style={{ zIndex: 1 }} />
      <div
        className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium backdrop-blur-md"
        style={{
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid rgba(24,24,22,0.1)',
          color: 'var(--ti-ink-muted)',
        }}
      >
        Click map or drag pin
      </div>
    </div>
  );
};

export default InteractiveMap;

