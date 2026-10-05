import { useCallback, useState } from 'react';

export interface Coords {
  lat: number;
  lng: number;
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'ok'; coords: Coords }
  | { status: 'denied' | 'unavailable'; message: string };

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Pede a localização só quando a pessoa toca no botão. Nada é guardado. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' });

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable', message: 'Este aparelho não informa a localização.' });
      return;
    }
    setState({ status: 'asking' });
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'ok', coords: { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) } }),
      (err) =>
        setState(
          err.code === err.PERMISSION_DENIED
            ? { status: 'denied', message: 'Permissão de localização negada. Ative nas configurações do navegador.' }
            : { status: 'unavailable', message: 'Não deu para achar sua localização agora.' },
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { state, request, coords: state.status === 'ok' ? state.coords : null };
}

export interface Place {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const destination = (p: Place) =>
  p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : `${p.name}, ${p.address ?? ''}`;

export const mapsRoute = (p: Place) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination(p))}&travelmode=driving`;

export const wazeRoute = (p: Place) =>
  p.latitude != null && p.longitude != null
    ? `https://waze.com/ul?ll=${p.latitude},${p.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(destination(p))}&navigate=yes`;

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
