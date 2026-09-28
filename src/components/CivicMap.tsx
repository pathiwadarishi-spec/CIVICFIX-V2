import React, { useEffect, useRef } from 'react';
import { Map, Marker, NavigationControl, Popup, GeolocateControl, LngLatBounds, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure MapLibre Web Worker explicitly for Vite and bundlers
try {
  setWorkerUrl(maplibreWorkerUrl || '/maplibre-gl-worker.mjs');
} catch (err) {
  console.warn('Failed to set MapLibre worker URL via import, using static fallback:', err);
  setWorkerUrl('/maplibre-gl-worker.mjs');
}

export interface MapComplaint {
  id: number;
  complaintNumber: string;
  category: string;
  title: string;
  description?: string;
  publicLatitude?: number;
  publicLongitude?: number;
  latitude?: number;
  longitude?: number;
  status: string;
  priority?: string;
  address?: string;
}

interface CivicMapProps {
  complaints?: MapComplaint[];
  selectedComplaintId?: number | null;
  onSelectComplaint?: (complaint: MapComplaint) => void;
  pickerMode?: boolean;
  pickerCoords?: { lat: number; lng: number } | null;
  onPickerCoordsChange?: (coords: { lat: number; lng: number }) => void;
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  autoFitBounds?: boolean;
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  followUser?: boolean;
  autoGeolocate?: boolean;
  onUserLocationDetected?: (coords: { lat: number; lng: number; accuracy?: number }) => void;
}

export const CivicMap: React.FC<CivicMapProps> = ({
  complaints = [],
  selectedComplaintId,
  onSelectComplaint,
  pickerMode = false,
  pickerCoords,
  onPickerCoordsChange,
  center = [77.2090, 28.6139], // Default: India (New Delhi / NCR)
  zoom = 12,
  heightClass = 'h-[500px]',
  autoFitBounds = true,
  userLocation,
  followUser = false,
  autoGeolocate = false,
  onUserLocationDetected,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const pickerMarkerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);
  const initialFitDone = useRef<boolean>(false);

  // Determine Map Style: MapTiler if key available, else reliable OSM raster
  const mapTilerKey = (import.meta as any).env?.VITE_MAPTILER_API_KEY || '';
  const mapStyle: any = mapTilerKey
    ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`
    : {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialCenter: [number, number] =
      pickerMode && pickerCoords
        ? [pickerCoords.lng, pickerCoords.lat]
        : center;

    const map = new Map({
      container: mapContainer.current,
      style: mapStyle,
      center: initialCenter,
      zoom: zoom,
      attributionControl: { compact: true },
    });

    // Add navigation controls (zoom, compass)
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right');

    // Add browser GPS auto-location button directly on the map
    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
    });
    map.addControl(geolocate, 'top-right');

    // Forward geolocate events
    geolocate.on('geolocate', (e: any) => {
      if (e.coords) {
        const detected = {
          lat: Number(e.coords.latitude.toFixed(6)),
          lng: Number(e.coords.longitude.toFixed(6)),
          accuracy: e.coords.accuracy ? Math.round(e.coords.accuracy) : undefined,
        };
        onUserLocationDetected?.(detected);
        if (pickerMode && onPickerCoordsChange) {
          onPickerCoordsChange({ lat: detected.lat, lng: detected.lng });
        }
      }
    });

    map.on('load', () => {
      if (autoGeolocate) {
        // Trigger browser GPS prompt and lock
        setTimeout(() => {
          try {
            geolocate.trigger();
          } catch {}
        }, 500);
      }
    });

    mapRef.current = map;

    // In picker mode, clicking on the map moves the pin
    if (pickerMode && onPickerCoordsChange) {
      map.on('click', (e) => {
        const coords = { lat: Number(e.lngLat.lat.toFixed(6)), lng: Number(e.lngLat.lng.toFixed(6)) };
        onPickerCoordsChange(coords);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Auto-fit bounds to visible complaints
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pickerMode || !autoFitBounds || complaints.length === 0) return;

    // Calculate bounds of visible complaints
    const bounds = new LngLatBounds();
    let hasCoords = false;

    complaints.forEach((c) => {
      const lat = c.publicLatitude ?? c.latitude;
      const lng = c.publicLongitude ?? c.longitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        bounds.extend([lng, lat]);
        hasCoords = true;
      }
    });

    if (hasCoords && !initialFitDone.current) {
      initialFitDone.current = true;
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
    }
  }, [complaints, autoFitBounds, pickerMode]);

  // React to center updates (e.g. Locate Me or city search)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.flyTo({
      center: center,
      zoom: Math.max(map.getZoom(), 13),
      duration: 1000,
    });
  }, [center]);

  // Handle Draggable Picker Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pickerMode) return;

    if (!pickerMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'civic-picker-marker';
      el.innerHTML = `
        <div style="background-color: #ef4444; width: 36px; height: 36px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4); cursor: grab;">
          <div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      `;

      const marker = new Marker({ element: el, draggable: true })
        .setLngLat(pickerCoords ? [pickerCoords.lng, pickerCoords.lat] : center)
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        if (onPickerCoordsChange) {
          onPickerCoordsChange({
            lat: Number(lngLat.lat.toFixed(6)),
            lng: Number(lngLat.lng.toFixed(6)),
          });
        }
      });

      pickerMarkerRef.current = marker;
    } else if (pickerCoords) {
      pickerMarkerRef.current.setLngLat([pickerCoords.lng, pickerCoords.lat]);
    }
  }, [pickerCoords, pickerMode]);

  // Handle Live User GPS Beacon Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'live-user-gps-beacon cursor-pointer';
      el.innerHTML = `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(59, 130, 246, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="position: absolute; width: 20px; height: 20px; border-radius: 50%; background: rgba(37, 99, 235, 0.5);"></div>
          <div style="position: relative; width: 12px; height: 12px; border-radius: 50%; background: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 0 8px rgba(37, 99, 235, 0.8);"></div>
        </div>
      `;

      const popup = new Popup({ offset: 16, closeButton: false }).setHTML(`
        <div style="padding: 6px 10px; font-family: sans-serif; font-size: 11px; line-height: 1.3; color: #0f172a; text-align: left;">
          <div style="font-weight: 700; color: #2563eb; display: flex; align-items: center; gap: 4px;">
            <span>📍 Your Live Location</span>
          </div>
          <div style="color: #64748b; margin-top: 2px;">Accuracy: ±${userLocation.accuracy ?? '—'}m</div>
          <div style="color: #94a3b8; font-size: 10px;">${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}</div>
        </div>
      `);

      const marker = new Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(popup)
        .addTo(map);

      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat]);
    }

    if (followUser) {
      map.easeTo({
        center: [userLocation.lng, userLocation.lat],
        duration: 800,
      });
    }
  }, [userLocation, followUser]);

  // Handle Complaints Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || pickerMode) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Helper for category emoji
    const getCategoryIcon = (cat: string) => {
      const c = (cat || '').toLowerCase();
      if (c.includes('pothole')) return '🕳️';
      if (c.includes('garbage') || c.includes('dumping') || c.includes('waste')) return '🗑️';
      if (c.includes('road') || c.includes('footpath')) return '🚧';
      if (c.includes('streetlight') || c.includes('light') || c.includes('electrical')) return '💡';
      if (c.includes('drainage') || c.includes('flood')) return '🌊';
      if (c.includes('water') || c.includes('leak')) return '💧';
      if (c.includes('traffic') || c.includes('sign')) return '🛑';
      return '⚠️';
    };

    complaints.forEach((comp) => {
      const lat = comp.publicLatitude ?? comp.latitude;
      const lng = comp.publicLongitude ?? comp.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const isSelected = comp.id === selectedComplaintId;

      // Color based on status
      let bgColor = '#3b82f6'; // blue for VERIFIED
      if (comp.status === 'RESOLVED') bgColor = '#10b981'; // green
      else if (comp.status === 'IN_PROGRESS' || comp.status === 'ACCEPTED' || comp.status === 'ARRIVED' || comp.status === 'ASSIGNED') bgColor = '#f59e0b'; // amber
      else if (comp.status === 'REPORTED') bgColor = '#ef4444'; // red

      const categoryEmoji = getCategoryIcon(comp.category);

      const el = document.createElement('div');
      el.className = 'civic-complaint-marker';
      el.innerHTML = `
        <div style="background-color: ${bgColor}; width: ${isSelected ? '36px' : '30px'}; height: ${isSelected ? '36px' : '30px'}; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s ease;">
          <span style="transform: rotate(45deg); font-size: ${isSelected ? '14px' : '12px'}; line-height: 1;">${categoryEmoji}</span>
        </div>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onSelectComplaint) {
          onSelectComplaint(comp);
        }
        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 14),
          duration: 600,
        });
      });

      const popup = new Popup({ offset: 25, closeButton: false }).setHTML(`
        <div style="padding: 8px 10px; font-family: system-ui; max-width: 220px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: #64748b;">${comp.complaintNumber}</span>
            <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${bgColor}20; color: ${bgColor}; text-transform: uppercase;">${comp.status}</span>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${comp.title}</div>
          <div style="font-size: 11px; color: #475569;">${comp.category} • ${comp.address || 'Location'}</div>
        </div>
      `);

      const marker = new Marker({ element: el })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [complaints, selectedComplaintId, pickerMode]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden border border-slate-800 ${heightClass}`}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};
