// Minimal boundary around Google's dynamically loaded browser SDK.
// Google classes are external runtime objects; no credentials are stored here.
export type Point = { lat: number; lng: number };
export type Destination = { id: string; name: string; address: string; point: Point };
export const PILOT_CENTER: Point = { lat: -22.523, lng: -44.104 };
const key = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
type MapsWindow = Window & { google?: { maps: any }; gm_authFailure?: () => void; __seeMapLoaded?: () => void };
let pending: Promise<any> | undefined;
export function loadGoogleMaps(): Promise<any> {
  if (!key) return Promise.reject(new Error('Chave do Google Maps não configurada no Vercel.'));
  const w = window as MapsWindow;
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let timer: number;
    const fail = (message: string) => {
      window.clearTimeout(timer);
      script.remove();
      delete w.__seeMapLoaded;
      reject(new Error(message));
      window.dispatchEvent(new Event('seemap-map-error'));
    };
    w.gm_authFailure = () => fail('Google Maps recusou a chave. Confira as restrições e a cota.');
    w.__seeMapLoaded = () => {
      window.clearTimeout(timer);
      delete w.__seeMapLoaded;
      if (w.google?.maps?.importLibrary) resolve(w.google.maps);
      else fail('Google Maps não disponibilizou a biblioteca esperada.');
    };
    const params = new URLSearchParams({ key, v: 'weekly', language: 'pt-BR', region: 'BR', loading: 'async', callback: '__seeMapLoaded' });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    script.onerror = () => fail('Falha ao carregar o Google Maps. Verifique sua conexão.');
    timer = window.setTimeout(() => fail('Tempo limite ao carregar o Google Maps.'), 20000);
    document.head.appendChild(script);
  });
  return pending;
}
