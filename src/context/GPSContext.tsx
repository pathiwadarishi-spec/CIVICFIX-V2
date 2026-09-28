import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

export interface LiveLocation {
  lat: number;
  lng: number;
  accuracy: number; // in meters
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export type GPSStatus = 'idle' | 'prompt' | 'locating' | 'active' | 'denied' | 'error' | 'unsupported';

interface GPSContextType {
  isSupported: boolean;
  isTracking: boolean;
  status: GPSStatus;
  location: LiveLocation | null;
  address: string | null;
  errorMessage: string | null;
  startTracking: () => void;
  stopTracking: () => void;
  toggleTracking: () => void;
  refreshLocation: () => Promise<LiveLocation | null>;
  calculateDistance: (lat: number, lng: number) => number | null; // in kilometers
  formatDistance: (km: number | null) => string;
}

const GPSContext = createContext<GPSContextType | undefined>(undefined);

// Haversine distance formula
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceKm(km: number | null): string {
  if (km === null || isNaN(km)) return '';
  if (km < 0.05) return 'Right here (< 50m)';
  if (km < 1) {
    return `${Math.round(km * 1000)} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

export const GPSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isSupported = typeof window !== 'undefined' && 'geolocation' in navigator;
  const [isTracking, setIsTracking] = useState<boolean>(() => {
    try {
      return localStorage.getItem('civicfix_live_gps') === 'true';
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState<GPSStatus>(isSupported ? 'idle' : 'unsupported');
  const [location, setLocation] = useState<LiveLocation | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const lastGeocodedCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Reverse Geocode helper (throttled)
  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    if (
      lastGeocodedCoords.current &&
      calculateDistanceKm(
        lastGeocodedCoords.current.lat,
        lastGeocodedCoords.current.lng,
        lat,
        lng
      ) < 0.05
    ) {
      return; // Skipped if moved < 50 meters
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          lastGeocodedCoords.current = { lat, lng };
          setAddress(data.display_name);
        }
      }
    } catch {
      // Ignore network errors on reverse geocode
    }
  }, []);

  const handlePositionSuccess = useCallback(
    (pos: GeolocationPosition) => {
      const newLoc: LiveLocation = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy),
        altitude: pos.coords.altitude ? Number(pos.coords.altitude.toFixed(1)) : null,
        altitudeAccuracy: pos.coords.altitudeAccuracy ? Math.round(pos.coords.altitudeAccuracy) : null,
        heading: pos.coords.heading ? Math.round(pos.coords.heading) : null,
        speed: pos.coords.speed ? Number((pos.coords.speed * 3.6).toFixed(1)) : null, // km/h
        timestamp: pos.timestamp,
      };

      setLocation(newLoc);
      setStatus('active');
      setErrorMessage(null);

      // Throttled address lookup
      fetchAddress(newLoc.lat, newLoc.lng);
    },
    [fetchAddress]
  );

  const handlePositionError = useCallback((err: GeolocationPositionError) => {
    let msg = 'Failed to acquire GPS location.';
    let newStatus: GPSStatus = 'error';

    if (err.code === err.PERMISSION_DENIED) {
      msg = 'Location permission was denied. Please allow location access in your browser.';
      newStatus = 'denied';
      setIsTracking(false);
      try {
        localStorage.setItem('civicfix_live_gps', 'false');
      } catch {}
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      msg = 'GPS signal unavailable. Please ensure location services are enabled.';
    } else if (err.code === err.TIMEOUT) {
      msg = 'Location request timed out. Retrying GPS satellite fix...';
    }

    setErrorMessage(msg);
    setStatus(newStatus);
  }, []);

  // Start continuous watch
  const startTracking = useCallback(() => {
    if (!isSupported) {
      setErrorMessage('Geolocation is not supported by your browser.');
      setStatus('unsupported');
      return;
    }

    setStatus('locating');
    setErrorMessage(null);
    setIsTracking(true);
    try {
      localStorage.setItem('civicfix_live_gps', 'true');
    } catch {}

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionSuccess,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000,
      }
    );
  }, [isSupported, handlePositionSuccess, handlePositionError]);

  // Stop continuous watch
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null && isSupported) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    setStatus('idle');
    try {
      localStorage.setItem('civicfix_live_gps', 'false');
    } catch {}
  }, [isSupported]);

  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking();
    } else {
      startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  // One-time refresh location
  const refreshLocation = useCallback(async (): Promise<LiveLocation | null> => {
    if (!isSupported) return null;
    setStatus('locating');
    setErrorMessage(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          handlePositionSuccess(pos);
          const loc: LiveLocation = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            accuracy: Math.round(pos.coords.accuracy),
            altitude: pos.coords.altitude ? Number(pos.coords.altitude.toFixed(1)) : null,
            altitudeAccuracy: pos.coords.altitudeAccuracy ? Math.round(pos.coords.altitudeAccuracy) : null,
            heading: pos.coords.heading ? Math.round(pos.coords.heading) : null,
            speed: pos.coords.speed ? Number((pos.coords.speed * 3.6).toFixed(1)) : null,
            timestamp: pos.timestamp,
          };
          resolve(loc);
        },
        (err) => {
          handlePositionError(err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [isSupported, handlePositionSuccess, handlePositionError]);

  // Calculate distance from current live location to a point
  const calculateDistance = useCallback(
    (lat: number, lng: number): number | null => {
      if (!location) return null;
      return calculateDistanceKm(location.lat, location.lng, lat, lng);
    },
    [location]
  );

  // Auto-init if enabled or query permission
  useEffect(() => {
    if (!isSupported) return;

    if (isTracking) {
      startTracking();
    } else {
      // Check permission without immediately prompting
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: 'geolocation' })
          .then((res) => {
            if (res.state === 'granted') {
              // Permission already granted, auto-activate live tracking for seamless user experience!
              startTracking();
            } else if (res.state === 'denied') {
              setStatus('denied');
            }
          })
          .catch(() => {});
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return (
    <GPSContext.Provider
      value={{
        isSupported,
        isTracking,
        status,
        location,
        address,
        errorMessage,
        startTracking,
        stopTracking,
        toggleTracking,
        refreshLocation,
        calculateDistance,
        formatDistance: formatDistanceKm,
      }}
    >
      {children}
    </GPSContext.Provider>
  );
};

export const useGPS = () => {
  const context = useContext(GPSContext);
  if (!context) {
    throw new Error('useGPS must be used within a GPSProvider');
  }
  return context;
};
