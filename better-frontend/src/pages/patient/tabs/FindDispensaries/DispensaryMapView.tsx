import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import type { NearbyDispensary } from '../../../../lib/patientApi';
import {
  createDispensaryMarker,
  createUserLocationMarker,
  getAvailabilityBadgeHtml,
} from './markerIcons';

interface DispensaryMapViewProps {
  lat: number;
  lng: number;
  locationLabel: string;
  dispensaries: NearbyDispensary[];
  selectedDispensaryId: number | null;
  onSelectDispensaryId: (id: number) => void;
  onFulfillFromMap: (d: NearbyDispensary) => void;
}

export const DispensaryMapView: React.FC<DispensaryMapViewProps> = ({
  lat,
  lng,
  locationLabel,
  dispensaries,
  selectedDispensaryId,
  onSelectDispensaryId,
  onFulfillFromMap,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    // User Location Pin
    const userMarker = L.marker([lat, lng], {
      icon: createUserLocationMarker(),
      zIndexOffset: 1000,
    }).addTo(markersGroup);
    userMarker.bindPopup(`
      <div style="font-family: inherit; font-size: 0.85rem; padding: 2px;">
        <strong>Your Search Location</strong><br/>
        <span style="color: #64748b; font-size: 0.78rem;">${locationLabel}</span>
      </div>
    `);

    const bounds = L.latLngBounds([L.latLng(lat, lng)]);

    // Dispensary Pins
    dispensaries.forEach((d) => {
      if (d.latitude == null || d.longitude == null) return;

      const isSelected = d.dispensary_id === selectedDispensaryId;
      const marker = L.marker([d.latitude, d.longitude], {
        icon: createDispensaryMarker(d.availability?.overall_status, isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      }).addTo(markersGroup);

      const statusBadge = d.availability
        ? getAvailabilityBadgeHtml(d.availability.overall_status, d.availability.available_count, d.availability.total_count)
        : '';

      const rankBadge = d.ranking
        ? `<div style="display:inline-block;padding:2px 7px;border-radius:12px;font-size:0.72rem;font-weight:700;background:${
            d.ranking.rank === 1 ? '#fef3c7;color:#b45309;border:1px solid #fcd34d;' : '#f1f5f9;color:#0284c7;border:1px solid #cbd5e1;'
          }margin-bottom:6px;">${d.ranking.rank === 1 ? '🏆 #1 Top Pick' : `#${d.ranking.rank} Ranked Match`} • ${d.ranking.rank_score}%</div>`
        : '';

      const popupHtml = `
        <div style="font-family:inherit;font-size:0.85rem;min-width:190px;">
          ${rankBadge}
          <div style="font-weight:700;color:#0f172a;margin-bottom:2px;">${d.name}</div>
          <div style="font-size:0.75rem;color:#64748b;margin-bottom:6px;">${d.address}</div>
          <div style="font-size:0.78rem;font-weight:600;color:#0284c7;margin-bottom:6px;">📍 ${d.distance_km != null ? `${d.distance_km} km` : 'Nearby'}</div>
          ${statusBadge}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;background:#f1f5f9;color:#0284c7;text-decoration:none;padding:5px 8px;border-radius:6px;font-weight:600;font-size:0.75rem;">Directions</a>
            <button id="rx-fulfill-btn-${d.dispensary_id}" style="flex:2;background:#0284c7;color:#ffffff;border:none;padding:5px 10px;border-radius:6px;font-weight:600;font-size:0.75rem;cursor:pointer;">Fulfill Here</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.on('click', () => onSelectDispensaryId(d.dispensary_id));
      marker.on('popupopen', () => {
        const btn = document.getElementById(`rx-fulfill-btn-${d.dispensary_id}`);
        if (btn) btn.onclick = () => onFulfillFromMap(d);
      });

      if (isSelected) marker.openPopup();
      bounds.extend([d.latitude, d.longitude]);
    });

    if (dispensaries.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView([lat, lng], 13);
    }
  }, [dispensaries, selectedDispensaryId, lat, lng, locationLabel, onSelectDispensaryId, onFulfillFromMap]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border-color shadow-sm min-h-[500px]">
      <div ref={mapContainerRef} className="w-full h-full min-h-[580px]" />
      {/* Overlay Badge */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-900/85 backdrop-blur text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow">
        <MapPin size={13} className="text-sky-400" />
        <span>Center: {locationLabel}</span>
      </div>
      {/* Map Legend */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-lg border border-black/10 text-xs flex flex-col gap-1 text-slate-800 shadow">
        <div className="font-bold text-slate-900">Stock Legend:</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span>All In Stock</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /><span>Partially In Stock</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span>Out of Stock</span></div>
      </div>
    </div>
  );
};

export default DispensaryMapView;

