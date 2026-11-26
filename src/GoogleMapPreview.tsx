import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Volume2 } from 'lucide-react';
import { loadGoogleMaps, PILOT_CENTER } from './lib/googleMaps';
import type { Destination, Point } from './lib/googleMaps';

type Fix = { point: Point; accuracy: number; timestamp: number };
type Preview = { distance: number | null; duration: number | null; steps: { text: string; meters: number | null }[] };
export default function GoogleMapPreview({ announce }: { announce: (message: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const sdkRef = useRef<any>(null);
  const overlays = useRef<any[]>([]);
  const routeLines = useRef<any[]>([]);
  const generation = useRef(0);
  const watch = useRef<number | null>(null);
  const gpsGeneration = useRef(0);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [useGPS, setUseGPS] = useState(false);
  const [step, setStep] = useState(0);
  const [originLabel, setOriginLabel] = useState('');

  function clearRoute() {
    routeLines.current.forEach(line => line.setMap(null)); routeLines.current = [];
    setPreview(null); setStep(0); setOriginLabel('');
  }
  function clearWatch() {
    gpsGeneration.current++;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
  }
  useEffect(() => {
    let disposed = false;
    const onFailure = () => { if (!disposed) { setReady(false); setMapError('Falha de autenticação ou carregamento do Google Maps. Confira a chave e recarregue a página.'); } };
    window.addEventListener('seemap-map-error', onFailure);
    void (async () => {
      try {
        const sdk = await loadGoogleMaps();
        const { Map } = await sdk.importLibrary('maps');
        if (disposed || !host.current) return;
        sdkRef.current = sdk;
        mapRef.current = new Map(host.current, { center: PILOT_CENTER, zoom: 15, mapId: 'DEMO_MAP_ID', mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: 'cooperative' });
        setReady(true);
      } catch (error) { if (!disposed) setMapError(error instanceof Error ? error.message : 'Google Maps indisponível.'); }
    })();
    return () => {
      disposed = true; generation.current++; clearWatch();
      window.removeEventListener('seemap-map-error', onFailure);
      overlays.current.forEach(o => { if (o.setMap) o.setMap(null); else o.map = null; }); overlays.current = [];
      routeLines.current.forEach(o => o.setMap(null)); routeLines.current = [];
      mapRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let disposed = false;
    const map = mapRef.current;
    overlays.current.forEach(o => { if (o.setMap) o.setMap(null); else o.map = null; }); overlays.current = [];
    void (async () => {
      try {
        const { AdvancedMarkerElement } = await sdkRef.current.importLibrary('marker');
        if (disposed) return;
        if (fix) overlays.current.push(new AdvancedMarkerElement({ map, position: fix.point, title: 'Localização estimada pelo dispositivo' }));
        if (destination) overlays.current.push(new AdvancedMarkerElement({ map, position: destination.point, title: destination.name }));
      } catch { if (!disposed) setMessage('Não foi possível exibir os marcadores.'); }
    })();
    return () => { disposed = true; };
  }, [ready, fix, destination]);

  function startGPS() {
    if (!navigator.geolocation) { setGpsError('Localização não disponível neste navegador.'); return; }
    if (watch.current !== null) return;
    setGpsError(''); setTracking(true);
    const gpsToken = ++gpsGeneration.current;
    watch.current = navigator.geolocation.watchPosition(p => {
      if (gpsToken !== gpsGeneration.current) return;
      const point = { lat: p.coords.latitude, lng: p.coords.longitude };
      setFix({ point, accuracy: p.coords.accuracy, timestamp: p.timestamp }); setGpsError('');
    }, e => { if (gpsToken !== gpsGeneration.current) return; clearWatch(); setTracking(false); setFix(null); setUseGPS(false); generation.current++; setBusy(false); clearRoute(); setGpsError(e.code === 1 ? 'Permissão de localização negada.' : 'Localização indisponível. Tente novamente em local seguro.'); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  function stopGPS() {
    clearWatch(); setTracking(false); setFix(null); setUseGPS(false); generation.current++; setBusy(false); clearRoute();
  }
  async function search(e: React.FormEvent) {
    e.preventDefault(); if (!ready || busy || !query.trim()) return;
    const token = ++generation.current;
    setBusy(true); setMessage('Pesquisando no Google Maps…'); setResults([]); setDestination(null); clearRoute();
    try {
      const { Place } = await sdkRef.current.importLibrary('places');
      const response = await Place.searchByText({ textQuery: `${query.trim()} em Volta Redonda, RJ, Brasil`, fields: ['id', 'displayName', 'formattedAddress', 'location'], locationBias: PILOT_CENTER, maxResultCount: 8 });
      if (token !== generation.current) return;
      const found: Destination[] = (response.places || []).filter((p: any) => p.id && p.location).map((p: any) => ({ id: p.id, name: p.displayName || 'Local sem nome', address: p.formattedAddress || 'Endereço indisponível', point: { lat: p.location.lat(), lng: p.location.lng() } }));
      setResults(found); setMessage(found.length ? `${found.length} resultados. Confira o endereço antes de selecionar.` : 'Nenhum resultado encontrado.');
    } catch { if (token === generation.current) setMessage('Pesquisa indisponível. Confira a chave, a cota e a conexão.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  async function compute() {
    if (!ready || !destination || busy) return;
    const origin = useGPS ? fix?.point : PILOT_CENTER;
    if (!origin || (useGPS && (!fix || Date.now() - fix.timestamp > 30000 || fix.accuracy > 50))) { setMessage('Localização recente com precisão de até 50 m não disponível. Use a origem de referência para testes.'); return; }
    const token = ++generation.current;
    setBusy(true); clearRoute(); setMessage('Calculando prévia do percurso…');
    try {
      const [{ Route }, { Place }] = await Promise.all([sdkRef.current.importLibrary('routes'), sdkRef.current.importLibrary('places')]);
      const response = await Route.computeRoutes({ origin, destination: new Place({ id: destination.id }), travelMode: 'WALKING', fields: ['path', 'distanceMeters', 'durationMillis', 'legs.steps.instructions', 'legs.steps.distanceMeters'] });
      if (token !== generation.current) return;
      const route = response.routes?.[0];
      if (!route || !route.path?.length) throw new Error('no route');
      routeLines.current = route.createPolylines(); routeLines.current.forEach(line => line.setMap(mapRef.current));
      const bounds = new sdkRef.current.LatLngBounds(); route.path.forEach((p: any) => bounds.extend(p)); mapRef.current.fitBounds(bounds, 45);
      const steps = (route.legs || []).flatMap((leg: any) => (leg.steps || []).map((s: any) => ({ text: s.instructions || 'Instrução indisponível', meters: Number.isFinite(s.distanceMeters) ? s.distanceMeters : null })));
      setPreview({ distance: Number.isFinite(route.distanceMeters) ? route.distanceMeters : null, duration: Number.isFinite(route.durationMillis) ? route.durationMillis : null, steps });
      setOriginLabel(useGPS ? 'Posição estimada no instante do cálculo' : 'Ponto de referência em Volta Redonda (não é sua posição)');
      setMessage('Prévia calculada. Não use para se orientar em vias públicas.');
    } catch { if (token === generation.current) { clearRoute(); setMessage('Não foi possível calcular a rota. Não será exibido um trajeto fictício. Confira disponibilidade da Routes API e cota.'); } }
    finally { if (token === generation.current) setBusy(false); }
  }
  const instruction = preview?.steps[step];
  return <section className="gm-preview" aria-label="Laboratório de mapas SeeMAP">
    <div className="notice-banner"><div><strong>Mapa real — protótipo de laboratório</strong><span>Teste parado em local seguro. Percursos não auditados quanto a calçadas, travessias ou obstáculos. Não utilize para deslocamentos reais. Chave de demonstração, somente testes.</span></div></div>
    <div className="panel gm-panel">
      <h2>Localização e mapa</h2>
      <p>Região inicial: Volta Redonda, RJ. A posição de referência não representa sua localização.</p>
      <div ref={host} className="gm-canvas" aria-label="Mapa interativo do Google Maps" />
      <p role="status">{mapError || (!ready ? 'Carregando mapa…' : 'Mapa carregado.')}</p>
      <div className="gm-controls">
        <button className="primary-btn" onClick={tracking ? stopGPS : startGPS}><MapPin size={18}/>{tracking ? 'Desativar localização' : 'Autorizar localização'}</button>
        <button className="secondary-btn" disabled={!ready || !fix} onClick={() => { if (fix) { mapRef.current?.panTo(fix.point); mapRef.current?.setZoom(17); } }}>Centralizar posição</button>
      </div>
      <p role="status">{gpsError || (fix ? `Precisão estimada: ${Math.round(fix.accuracy)} m. Última leitura: ${new Date(fix.timestamp).toLocaleTimeString('pt-BR')}.` : tracking ? 'Obtendo posição…' : 'GPS desligado.')}</p>
      <small>A posição fica em memória nesta tela, não é salva no Supabase. O Google recebe coordenadas para mostrar marcadores e calcular rotas quando solicitado. Ao sair desta tela, o GPS é desligado.</small>
    </div>
    <div className="panel gm-panel">
      <h2>Pesquisar destino real</h2>
      <form onSubmit={search} className="gm-controls"><label htmlFor="gm-search">Destino em Volta Redonda</label><input id="gm-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: farmácia, padaria, praça"/><button className="primary-btn" disabled={!ready || busy || !query.trim()}><Search size={18}/> Buscar</button></form>
      {results.map(p => <article key={p.id} className="gm-result"><div><strong>{p.name}</strong><p>{p.address}</p><small>Acessibilidade e sensores não verificados.</small></div><button disabled={busy} className="secondary-btn" onClick={() => { clearRoute(); setDestination(p); mapRef.current?.panTo(p.point); setMessage('Destino selecionado.'); }}>Selecionar</button></article>)}
      <small>Resultados fornecidos pelo Google Maps.</small>
    </div>
    <div className="panel gm-panel">
      <h2>Prévia de rota a pé</h2><p>Destino: {destination?.name || 'Nenhum selecionado'}</p>
      <label className="gm-check"><input type="checkbox" checked={useGPS} disabled={!fix || busy} onChange={e => { setUseGPS(e.target.checked); clearRoute(); }}/><span>Usar posição estimada do dispositivo (envia a origem ao Google ao calcular)</span></label>
      <p>Sem essa opção, usamos um ponto de referência fixo na cidade.</p>
      <button className="primary-btn" disabled={!ready || !destination || busy} onClick={compute}>Calcular prévia</button>
      <p role="status">{message}</p>
      {preview && <div className="gm-route"><strong>Origem: {originLabel}</strong><p>Distância estimada: {preview.distance === null ? 'indisponível' : `${(preview.distance / 1000).toFixed(2)} km`} · Tempo estimado: {preview.duration === null ? 'indisponível' : `${Math.ceil(preview.duration / 60000)} min`}</p><p>Prévia fixa, sem atualização automática por GPS.</p>{instruction && <><p>Etapa de simulação {step + 1} de {preview.steps.length}: {instruction.text}{instruction.meters !== null ? ` (${instruction.meters} m)` : ''}</p><div className="gm-controls"><button className="secondary-btn" onClick={() => announce(`Prévia não validada. ${instruction.text}${instruction.meters !== null ? `. Distância do trecho: ${instruction.meters} metros.` : ''}`)}><Volume2 size={18}/> Ouvir prévia</button><button className="secondary-btn" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Anterior</button><button className="secondary-btn" disabled={step >= preview.steps.length - 1} onClick={() => setStep(s => s + 1)}>Próxima etapa</button></div></>}<button className="text-btn" onClick={clearRoute}>Limpar prévia</button></div>}
    </div>
  </section>;
}
