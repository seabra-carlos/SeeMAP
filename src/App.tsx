import { useEffect, useMemo, useState } from 'react';
import GoogleMapPreview from './GoogleMapPreview';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import {
  Accessibility, Activity, ArrowLeft, ArrowRight, AudioLines, Bell, Bus, Check,
  ChevronDown, CircleHelp, Contrast, Eye, EyeOff, Home, LogIn, MapPin, Menu,
  Moon, Navigation, Pause, Play, Search, Settings, ShieldCheck, Store, Sun,
  Volume2, VolumeX, Wifi, WifiOff, X, ZoomIn
} from 'lucide-react';

type Role = 'user' | 'merchant' | 'admin';
type Place = { id: number; name: string; category: string; address: string; lat: number; lng: number; sensor: boolean; sensorStatus: 'online' | 'offline' | 'none' };
type Notice = { id: number; message: string; time: string; read: boolean; simulated: boolean };

const places: Place[] = [
  { id: 1, name: 'Padaria Pão da Praça', category: 'Padaria', address: 'Rua das Flores, 120', lat: -23.5505, lng: -46.6333, sensor: true, sensorStatus: 'online' },
  { id: 2, name: 'Farmácia Bem Estar', category: 'Farmácia', address: 'Av. Central, 245', lat: -23.5530, lng: -46.6380, sensor: true, sensorStatus: 'online' },
  { id: 3, name: 'Mercado Boa Compra', category: 'Mercado', address: 'Rua do Comércio, 80', lat: -23.5475, lng: -46.6290, sensor: false, sensorStatus: 'none' },
  { id: 4, name: 'Restaurante Sabor & Cia', category: 'Restaurante', address: 'Alameda Sul, 55', lat: -23.5560, lng: -46.6300, sensor: true, sensorStatus: 'offline' },
  { id: 5, name: 'Banco Popular', category: 'Banco', address: 'Praça da República, 10', lat: -23.5480, lng: -46.6350, sensor: false, sensorStatus: 'none' },
  { id: 6, name: 'Hospital Central', category: 'Hospital', address: 'Av. Saúde, 900', lat: -23.5580, lng: -46.6420, sensor: false, sensorStatus: 'none' },
];
const categories = ['Todos', 'Padaria', 'Farmácia', 'Mercado', 'Restaurante', 'Hospital', 'Banco', 'Loja', 'Ponto de ônibus'];
const initialNotices: Notice[] = [
  { id: 1, message: 'Evento demonstrativo de aproximação — Padaria Pão da Praça.', time: 'Hoje, 09:42', read: false, simulated: true },
  { id: 2, message: 'Sensor ESP32-001 voltou a comunicar com a plataforma.', time: 'Hoje, 08:15', read: true, simulated: true },
];

const markerIcon = new L.Icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 14); }, [center, map]);
  return null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [profile, setProfile] = useState<{ id: string; full_name: string | null; role: Role } | null>(null);
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [recovery, setRecovery] = useState(() => sessionStorage.getItem('seemap-recovery') === '1' || new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery');
  const [busy, setBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [fullName, setFullName] = useState('');
  const role: Role = profile?.role ?? 'user';
  const logged = Boolean(authReady && session && profile?.id === session.user.id && !recovery);
  const name = profile?.full_name || 'Usuário';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [screen, setScreen] = useState('home');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<Place | null>(null);
  const [location, setLocation] = useState<[number, number]>([-23.5505, -46.6333]);
  const [locationLabel, setLocationLabel] = useState('Localização demonstrativa — São Paulo, SP');
  const [locationReal, setLocationReal] = useState(false);
  const [routeActive, setRouteActive] = useState(false);
  const [routePaused, setRoutePaused] = useState(false);
  const [step, setStep] = useState(0);
  const [volume, setVolume] = useState(true);
  const [rate, setRate] = useState(1);
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [dark, setDark] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [notices, setNotices] = useState(initialNotices);
  const [sensorOnline, setSensorOnline] = useState(true);
  const [demoMode, setDemoMode] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [indoorFloor, setIndoorFloor] = useState('2º andar');
  const [toast, setToast] = useState('');

  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') {
        sessionStorage.setItem('seemap-recovery', '1');
        setRecovery(true);
        setScreen('reset');
      }
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('seemap-recovery');
        setRecovery(false);
        setProfile(null);
        setPassword('');
        setFullName('');
        setEmail('');
        setScreen('home');
      }
      setSession(next);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setProfileError('');
    if (!supabase || !userId || recovery) return;
    const client = supabase;
    async function load() {
      try {
        const { data, error } = await client.from('profiles').select('id, full_name, role').eq('id', userId).single();
        if (cancelled) return;
        if (error || !data || !['user', 'merchant', 'admin'].includes(data.role)) {
          setProfileError('Não foi possível carregar seu perfil. Verifique a configuração do banco ou tente novamente.');
          return;
        }
        setProfile(data);
        setScreen(data.role === 'merchant' ? 'merchant' : data.role === 'admin' ? 'admin' : 'dashboard');
      } catch {
        if (!cancelled) setProfileError('Falha de conexão ao consultar o perfil. Tente novamente.');
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId, recovery, profileRetry]);

  function openAuth(next: string) {
    setAuthError(''); setAuthMessage(''); setPassword(''); setScreen(next);
  }

  const filtered = useMemo(() => places.filter(p => (category === 'Todos' || p.category === category) && `${p.name} ${p.category} ${p.address}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => Number(b.sensorStatus === 'online') - Number(a.sensorStatus === 'online')), [query, category]);
  const routeSteps = selected ? [`Rota demonstrativa iniciada para ${selected.name}.`, 'Exemplo de instrução de rota, sem orientação real.', 'A aproximação do destino está sendo simulada.', `Destino demonstrativo: ${selected.name}.`] : [];

  function announce(message: string) {
    setToast(message); window.setTimeout(() => setToast(''), 3600);
    if (volume && 'speechSynthesis' in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(message); utterance.lang = 'pt-BR'; utterance.rate = rate; window.speechSynthesis.speak(utterance); }
  }
  function locate() { setScreen('navigation'); }
  function startRoute(place = selected) {
    if (!place) { announce('Pesquise e escolha um destino antes de iniciar.'); return; }
    setSelected(place); setRouteActive(true); setRoutePaused(false); setStep(0);
    announce(`Iniciando demonstração de navegação para ${place.name}. As instruções desta versão são simuladas e não devem ser usadas para deslocamento real.`);
    setScreen('navigation');
  }
  function simulateDetection() {
    if (!demoMode) { announce('Modo de demonstração desativado. Nenhum sensor físico está conectado.'); return; }
    const n: Notice = { id: Date.now(), message: 'ALERTA SeeMap: detecção de aproximação simulada na Padaria Pão da Praça. Prepare um atendimento acessível.', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), read: false, simulated: true };
    setNotices(prev => [n, ...prev]); announce('Evento de detecção simulado. Uma notificação foi adicionada ao painel do comerciante.');
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setAuthError(''); setAuthMessage('');
    try {
      if (recovery) {
        if (!session) { setAuthError('Link inválido ou expirado. Solicite outro link de recuperação.'); return; }
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        // End the recovery session before allowing access to the application.
        const result = await supabase.auth.signOut();
        if (result.error) throw result.error;
        sessionStorage.removeItem('seemap-recovery');
        setRecovery(false); setScreen('login'); setAuthMessage('Senha atualizada. Entre novamente com sua nova senha.');
      } else if (screen === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' });
        if (error) throw error;
        setAuthMessage('Se a conta existir, você receberá um link de recuperação por e-mail. Confira também o spam.');
      } else if (screen === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin + '/' } });
        if (error) throw error;
        if (!data.session) { setScreen('login'); setAuthMessage('Confira seu e-mail para confirmar o cadastro antes de entrar.'); }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
      setPassword('');
    } catch (err) {
      const code = (err as {code?: string})?.code;
      setAuthError(code === 'invalid_credentials' ? 'E-mail ou senha incorretos.' : code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : code === 'over_email_send_rate_limit' ? 'Limite de envio de e-mails atingido. Tente mais tarde.' : 'Não foi possível concluir a operação. Confira os dados, a conexão e a configuração do Supabase.');
    } finally { setBusy(false); }
  }
  async function logout() {
    if (!supabase || busy) return;
    setBusy(true); setAuthError('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null); setProfile(null); setScreen('home'); setPassword(''); setEmail('');
      setSelected(null); setRouteActive(false); setRoutePaused(false); setStep(0); setQuery(''); setMobileMenu(false);
      setLocation([-23.5505, -46.6333]); setLocationReal(false); setLocationLabel('Localização demonstrativa — São Paulo, SP');
      setNotices(initialNotices); setSensorOnline(true); setToast('');
      window.speechSynthesis?.cancel();
    } catch { setAuthError('Não foi possível sair. Tente novamente.'); }
    finally { setBusy(false); }
  }


  const navItems = role === 'user' ? [ ['dashboard','Início',Home], ['explore','Encontrar destino',Search], ['navigation','Navegação',Navigation], ['indoor','Ambiente interno',Accessibility], ['bus','Ônibus',Bus], ['settings','Acessibilidade',Settings] ] as const : role === 'merchant' ? [['merchant','Painel',Home],['notifications','Notificações',Bell],['devices','Sensor',Wifi],['settings','Estabelecimento',Settings]] as const : [['admin','Visão geral',Activity],['users','Usuários',Accessibility],['businesses','Estabelecimentos',Store],['devices','Sensores',Wifi],['notifications','Eventos',Bell]] as const;

  return <div className={`${dark ? 'dark' : ''} ${highContrast ? 'contrast' : ''} ${reducedMotion ? 'reduced' : ''}`} style={{ fontSize: `${fontScale}em` }}>
    <a className="skip-link" href="#main">Pular para o conteúdo principal</a>
    <header className="topbar"><button className="brand" onClick={() => { setScreen(logged ? (role === 'user' ? 'dashboard' : role === 'merchant' ? 'merchant' : 'admin') : 'home'); }} aria-label="SeeMap — página inicial"><span className="brand-mark"><Navigation size={22}/></span><span>See<span>Map</span></span></button><div className="top-actions"><span className="demo-pill"><span/> Protótipo demonstrativo</span><button className="icon-btn" aria-label="Alternar alto contraste" onClick={() => setHighContrast(v => !v)}><Contrast/></button><button className="icon-btn" aria-label="Alternar tema escuro" onClick={() => setDark(v => !v)}>{dark ? <Sun/> : <Moon/>}</button>{session ? <button className="profile-btn" disabled={busy} onClick={logout}>Sair <ArrowRight size={16}/></button> : <button className="profile-btn" onClick={() => openAuth('login')}>Entrar <LogIn size={16}/></button>}<button className="icon-btn mobile-only" aria-label="Abrir menu" onClick={() => setMobileMenu(v => !v)}><Menu/></button></div></header>

    {authReady && !session && !recovery && !['login','register','forgot','reset'].includes(screen) ? <main id="main" className="landing">
      <section className="hero"><div className="hero-copy"><span className="eyebrow"><Accessibility size={16}/> TECNOLOGIA QUE INCLUI</span><h1>Sua mobilidade,<br/><em>sua autonomia.</em></h1><p>Encontre destinos, receba orientações por áudio e conecte-se a estabelecimentos preparados para oferecer um atendimento mais acessível.</p><div className="hero-buttons"><button className="primary-btn" onClick={() => openAuth('register')}>Começar agora <ArrowRight size={18}/></button><button className="secondary-btn" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}>Conheça o SeeMap</button></div><div className="trust-line"><ShieldCheck size={17}/> Acessibilidade pensada desde o primeiro toque</div></div><div className="hero-visual"><div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/><div className="phone-card"><div className="phone-top"><span/> <span/> <span/></div><div className="voice-wave"><AudioLines size={34}/></div><strong>Orientação por voz</strong><p>“Você está próximo ao seu destino.”</p><div className="mini-route"><span/><i/><b/></div><div className="phone-footer"><MapPin size={16}/> Destino ilustrativo</div></div><div className="floating-card"><span className="float-icon"><Wifi size={18}/></span><div><strong>Sensor ilustrativo</strong><small>Demonstração SeeMap</small></div><Check size={18} className="check-icon"/></div><div className="floating-tag"><AudioLines size={16}/> Navegação sonora</div></div></section>
      <section className="feature-strip" id="about"><article><span className="feature-icon coral"><AudioLines/></span><div><h3>Orientação por áudio</h3><p>Instruções faladas para apoiar a mobilidade sem depender do mapa visual.</p></div></article><article><span className="feature-icon blue"><MapPin/></span><div><h3>Destinos próximos</h3><p>Pesquisa de estabelecimentos e indicação de parceiros conectados.</p></div></article><article><span className="feature-icon green"><Wifi/></span><div><h3>Sensores inteligentes</h3><p>Integração planejada com ESP32 para alertar os comerciantes.</p></div></article></section>
      <section className="how-section"><div><span className="eyebrow">COMO FUNCIONA</span><h2>Um ecossistema conectado para facilitar caminhos.</h2><p>O SeeMap une aplicativo, sensores inteligentes e estabelecimentos parceiros em uma experiência centrada na autonomia.</p></div><div className="steps-grid"><div><b>01</b><h3>Escolha o destino</h3><p>Pesquise por categoria, nome ou comando de voz.</p></div><div><b>02</b><h3>Receba orientação</h3><p>Use a localização e os recursos de áudio para acompanhar o percurso.</p></div><div><b>03</b><h3>Chegue com acolhimento</h3><p>Um sensor integrado poderá notificar a equipe do estabelecimento.</p></div></div></section>
      <footer className="footer"><strong>SeeMap</strong><span>Sua mobilidade, sua autonomia.</span><span>Projeto acadêmico — protótipo demonstrativo</span></footer>
    </main> : null}

    {!authReady ? <main id="main" className="auth-wrap"><p role="status">Verificando sua sessão...</p></main> : null}
    {authReady && session && !logged && !recovery ? <main id="main" className="auth-wrap"><div className="auth-card"><h1>Carregando perfil</h1>{profileError ? <><p role="alert">{profileError}</p><button className="primary-btn" onClick={() => setProfileRetry(v => v + 1)}>Tentar novamente</button></> : <p role="status">Consultando seu perfil no Supabase...</p>}<button className="secondary-btn" disabled={busy} onClick={logout}>Sair da conta</button></div></main> : null}
    {authReady && !logged && (recovery || (!session && ['login','register','forgot','reset'].includes(screen))) ? <main id="main" className="auth-wrap">
      {!recovery && <button className="back-link" onClick={() => openAuth('home')}><ArrowLeft size={17}/> Voltar ao início</button>}
      <form className="auth-card" onSubmit={login}>
        <div className="auth-symbol"><Navigation/></div><span className="eyebrow">BEM-VINDO AO SEEMAP</span>
        <h1>{recovery ? 'Defina uma nova senha' : screen === 'register' ? 'Crie seu acesso' : screen === 'forgot' ? 'Recuperar senha' : 'Entre na plataforma'}</h1>
        <p>Autenticação pelo Supabase. O cadastro cria uma conta de usuário comum.</p>
        {!supabase && <p role="alert">Supabase não configurado. Defina as variáveis públicas no ambiente de publicação.</p>}
        {screen === 'register' && !recovery && <><label htmlFor="full-name">Nome</label><input id="full-name" autoComplete="name" maxLength={100} required value={fullName} onChange={e => setFullName(e.target.value)}/></>}
        {!recovery && <><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com"/></>}
        {(recovery || screen !== 'forgot') && <><label htmlFor="password">{recovery ? 'Nova senha' : 'Senha'}</label><input id="password" type="password" autoComplete={recovery || screen === 'register' ? 'new-password' : 'current-password'} minLength={recovery || screen === 'register' ? 8 : 1} required value={password} onChange={e => setPassword(e.target.value)}/></>}
        {authError && <p role="alert">{authError}</p>}{authMessage && <p role="status">{authMessage}</p>}
        <button className="primary-btn full" disabled={!supabase || busy || (recovery && !session)} type="submit">{busy ? 'Processando...' : recovery ? 'Salvar nova senha' : screen === 'register' ? 'Criar conta' : screen === 'forgot' ? 'Enviar link' : 'Entrar'} <ArrowRight size={18}/></button>
        {!recovery && screen === 'login' && <><button type="button" className="text-btn" onClick={() => openAuth('forgot')}>Esqueci minha senha</button><button type="button" className="text-btn" onClick={() => openAuth('register')}>Criar conta</button></>}
        {!recovery && screen !== 'login' && <button type="button" className="text-btn" onClick={() => openAuth('login')}>Voltar ao login</button>}
        {recovery && <button type="button" className="text-btn" onClick={async () => { if (session) await logout(); else { sessionStorage.removeItem('seemap-recovery'); setRecovery(false); openAuth('forgot'); } }}>Cancelar recuperação</button>}
      </form></main> : null}


    {logged ? <div className="app-shell"><aside className={`sidebar ${mobileMenu ? 'open' : ''}`}><div className="side-user"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div><strong>{name}</strong><small>{role === 'user' ? 'Área do usuário' : role === 'merchant' ? 'Painel do comerciante' : 'Administração'}</small></div><button className="close-menu mobile-only" aria-label="Fechar menu" onClick={() => setMobileMenu(false)}><X/></button></div><nav aria-label="Navegação principal">{navItems.map(([id,label,Icon]) => <button key={id} className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => { setScreen(id); setMobileMenu(false); }}><Icon size={19}/><span>{label}</span>{id === 'notifications' && notices.some(n => !n.read) ? <i className="nav-dot"/> : null}</button>)}</nav><div className="sidebar-bottom"><div className="help-box"><CircleHelp size={18}/><div><strong>Precisa de ajuda?</strong><small>Consulte as opções de acessibilidade.</small></div></div><button className="nav-item" onClick={logout}><ArrowLeft size={18}/> Sair da conta</button></div></aside>
      <main id="main" className="workspace"><div className="workspace-top"><div><span className="eyebrow">{role === 'user' ? 'ESPAÇO DE MOBILIDADE' : role === 'merchant' ? 'ÁREA DO PARCEIRO' : 'GESTÃO DA PLATAFORMA'}</span><h1>{screen === 'dashboard' ? `Olá, ${name}!` : screen === 'explore' ? 'Encontre seu destino' : screen === 'navigation' ? 'Navegação guiada' : screen === 'indoor' ? 'Orientação em ambientes internos' : screen === 'bus' ? 'Transporte público' : screen === 'settings' ? 'Acessibilidade e preferências' : screen === 'merchant' ? 'Painel do estabelecimento' : screen === 'notifications' ? 'Central de notificações' : screen === 'devices' ? 'Sensores conectados' : screen === 'admin' ? 'Visão geral da plataforma' : screen === 'users' ? 'Usuários cadastrados' : screen === 'businesses' ? 'Estabelecimentos parceiros' : 'Painel SeeMap'}</h1></div><div className="workspace-status"><span className="live-dot"/> Sistema demonstrativo</div></div>

      {role === 'user' && screen === 'dashboard' ? <><section className="welcome-card"><div><span className="eyebrow">SEU PRÓXIMO CAMINHO COMEÇA AQUI</span><h2>Para onde vamos hoje?</h2><p>Pesquise destinos reais e consulte prévias experimentais de percurso.</p><button className="primary-btn" onClick={() => setScreen('explore')}>Encontrar um destino <ArrowRight size={18}/></button></div><div className="welcome-art"><Navigation size={72}/><span>SeeMap</span></div></section><div className="section-heading"><h2>Acesso rápido</h2><span>Escolha uma funcionalidade</span></div><div className="quick-grid"><button onClick={() => setScreen('explore')}><span className="quick-icon coral"><Search/></span><strong>Pesquisar destino</strong><small>Encontre locais próximos</small></button><button onClick={locate}><span className="quick-icon blue"><MapPin/></span><strong>Minha localização</strong><small>Ouça sua posição atual</small></button><button onClick={() => setScreen('bus')}><span className="quick-icon green"><Bus/></span><strong>Ônibus</strong><small>Consultar pontos e linhas</small></button><button onClick={() => setScreen('indoor')}><span className="quick-icon purple"><Accessibility/></span><strong>Ambiente interno</strong><small>Explorar demonstração</small></button></div><section className="panel location-panel"><div><span className="eyebrow">LOCALIZAÇÃO</span><h3>Localização sob demanda</h3><p>Abra o mapa de teste e autorize a localização somente se desejar.</p></div><button className="secondary-btn" onClick={locate}><MapPin size={17}/> Atualizar localização</button></section></> : null}

      {role === 'user' && (screen === 'explore' || screen === 'navigation') ? <GoogleMapPreview announce={announce}/> : null}

      {role === 'user' && screen === 'indoor' ? <><div className="notice-banner"><Accessibility/><div><strong>Localização interna demonstrativa</strong><span>Depende da instalação de beacons ou sensores no edifício. Não há infraestrutura física conectada.</span></div></div><section className="indoor-card"><div className="indoor-head"><div><span className="eyebrow">LOCALIZAÇÃO APROXIMADA</span><h2>Shopping SeeMap</h2><p>Ambiente fictício para testar a experiência sonora.</p></div><div className="floor-badge">{indoorFloor}</div></div><div className="floor-picker"><button className={indoorFloor === 'Térreo' ? 'chosen' : ''} onClick={() => setIndoorFloor('Térreo')}>Térreo</button><button className={indoorFloor === '1º andar' ? 'chosen' : ''} onClick={() => setIndoorFloor('1º andar')}>1º andar</button><button className={indoorFloor === '2º andar' ? 'chosen' : ''} onClick={() => setIndoorFloor('2º andar')}>2º andar</button></div><div className="indoor-grid">{[['Elevador','Próximo ao corredor central'],['Escadas','À esquerda do elevador'],['Praça de alimentação','Setor leste'],['Lojas','Corredor principal']].map(([a,b]) => <button key={a} onClick={() => announce(`${a}. ${b}. Localização interna demonstrativa.`)}><MapPin/><strong>{a}</strong><span>{b}</span><small>Ouvir orientação <AudioLines size={14}/></small></button>)}</div><button className="primary-btn" onClick={() => announce(`Demonstração: você está no ${indoorFloor}, próximo ao corredor central.`)}><AudioLines size={18}/> Ouvir minha localização</button></section></> : null}

      {role === 'user' && screen === 'bus' ? <><div className="notice-banner"><Bus/><div><strong>Consulta de transporte demonstrativa</strong><span>Não há API de transporte conectada. Linhas e horários reais não são exibidos nesta versão.</span></div></div><section className="panel bus-panel"><h2>Planeje seu embarque</h2><label htmlFor="bus-dest">Para onde deseja ir?</label><div className="search-row"><Search/><input id="bus-dest" placeholder="Ex.: Centro"/><button className="primary-btn" onClick={() => announce('Consulta demonstrativa. Para horários e linhas reais, é necessária integração com a API de transporte da cidade.')}>Consultar</button></div><div className="bus-point"><MapPin/><div><strong>Ponto de ônibus próximo (exemplo)</strong><span>Localização ilustrativa — sem linha ou previsão real.</span></div><button className="secondary-btn small" disabled>Sem integração</button></div></section></> : null}

      {role === 'user' && screen === 'settings' ? <section className="settings-grid"><div className="panel"><h2>Preferências visuais</h2><div className="setting-row"><div><strong>Alto contraste</strong><small>Realça a diferença entre texto e fundo.</small></div><button className={`switch ${highContrast ? 'on' : ''}`} role="switch" aria-checked={highContrast} onClick={() => setHighContrast(v => !v)}><span/></button></div><div className="setting-row"><div><strong>Tema escuro</strong><small>Altera a aparência da interface.</small></div><button className={`switch ${dark ? 'on' : ''}`} role="switch" aria-checked={dark} onClick={() => setDark(v => !v)}><span/></button></div><div className="setting-row"><div><strong>Reduzir animações</strong><small>Minimiza movimentos decorativos.</small></div><button className={`switch ${reducedMotion ? 'on' : ''}`} role="switch" aria-checked={reducedMotion} onClick={() => setReducedMotion(v => !v)}><span/></button></div><div className="setting-row"><div><strong>Tamanho do texto</strong><small>Ajuste a leitura da interface.</small></div><div className="font-controls"><button aria-label="Diminuir texto" onClick={() => setFontScale(v => Math.max(.9, +(v - .1).toFixed(1)))}><ZoomIn size={15}/>-</button><strong>{Math.round(fontScale * 100)}%</strong><button aria-label="Aumentar texto" onClick={() => setFontScale(v => Math.min(1.3, +(v + .1).toFixed(1)))}><ZoomIn size={15}/>+</button></div></div></div><div className="panel"><h2>Preferências de áudio</h2><div className="setting-row"><div><strong>Orientação por voz</strong><small>Utiliza a síntese de voz do navegador.</small></div><button className={`switch ${volume ? 'on' : ''}`} role="switch" aria-checked={volume} onClick={() => setVolume(v => !v)}><span/></button></div><label htmlFor="speech-rate">Velocidade da fala: {rate.toFixed(1)}x</label><input id="speech-rate" type="range" min="0.7" max="1.4" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))}/><button className="secondary-btn" onClick={() => announce('Este é um exemplo de orientação por áudio do SeeMap.')}>Testar áudio <AudioLines size={17}/></button><p className="helper-text">A disponibilidade e a voz dependem do navegador e do dispositivo.</p></div></section> : null}

      {role === 'merchant' && (screen === 'merchant' || screen === 'notifications' || screen === 'devices' || screen === 'settings') ? <><div className="stats-grid"><div className="stat-card"><span className="stat-icon coral"><Bell/></span><small>Notificações</small><strong>{notices.length}</strong></div><div className="stat-card"><span className="stat-icon green"><Wifi/></span><small>Status do sensor</small><strong>{sensorOnline ? 'Online' : 'Offline'}</strong></div><div className="stat-card"><span className="stat-icon blue"><Store/></span><small>Estabelecimento</small><strong>Parceiro</strong></div></div>{screen === 'merchant' || screen === 'settings' ? <section className="panel merchant-panel"><div className="panel-title"><div><span className="eyebrow">ESTABELECIMENTO CADASTRADO</span><h2>Padaria Pão da Praça</h2><p>Rua das Flores, 120 · Categoria: Padaria</p></div><span className="connected-tag"><span/> Parceiro SeeMap</span></div><div className="device-row"><div className="device-symbol"><Wifi/></div><div><strong>ESP32-001</strong><span>Sensor de proximidade · Última comunicação: demonstração</span><small className={sensorOnline ? 'status-online' : 'status-offline'}>{sensorOnline ? 'Conectado (simulado)' : 'Desconectado (simulado)'}</small></div><button className="secondary-btn small" onClick={() => setSensorOnline(v => !v)}>Alternar status</button></div><div className="panel-actions"><button className="primary-btn" onClick={simulateDetection}><Activity size={17}/> Simular detecção</button><button className="secondary-btn" onClick={() => setScreen('notifications')}>Ver notificações <ArrowRight size={16}/></button></div><p className="helper-text">O botão de detecção cria um evento de demonstração. Nenhum ESP32 físico foi conectado.</p></section> : null}{screen === 'devices' ? <section className="panel"><h2>Dispositivo ESP32</h2><p>Identificação: ESP32-001 · Protocolo previsto: Wi-Fi / HTTP ou MQTT.</p><div className="device-row"><Wifi/><strong>{sensorOnline ? 'Conectado (simulado)' : 'Desconectado (simulado)'}</strong><button className="secondary-btn small" onClick={() => setSensorOnline(v => !v)}>Alternar status</button></div><button className="primary-btn" onClick={simulateDetection}>Testar evento de detecção</button></section> : null}{screen === 'notifications' ? <NoticeList notices={notices} setNotices={setNotices}/> : null}</> : null}

      {role === 'admin' ? <><div className="stats-grid admin-stats"><div className="stat-card"><span className="stat-icon blue"><Accessibility/></span><small>Usuários cadastrados</small><strong>128</strong><em>Dados fictícios</em></div><div className="stat-card"><span className="stat-icon coral"><Store/></span><small>Estabelecimentos</small><strong>24</strong><em>Dados fictícios</em></div><div className="stat-card"><span className="stat-icon green"><Wifi/></span><small>Sensores ativos</small><strong>18</strong><em>Dados fictícios</em></div><div className="stat-card"><span className="stat-icon purple"><Bell/></span><small>Notificações</small><strong>{notices.length + 46}</strong><em>Inclui dados fictícios</em></div></div><section className="panel"><div className="panel-title"><div><span className="eyebrow">MONITORAMENTO</span><h2>Saúde dos dispositivos</h2></div><span className="demo-pill">Dados simulados</span></div><div className="admin-device"><span className="live-dot"/><div><strong>ESP32-001 · Padaria Pão da Praça</strong><small>Última comunicação: há 2 minutos (simulado)</small></div><span className="status-online">Ativo</span></div><div className="admin-device"><span className="offline-dot"/><div><strong>ESP32-004 · Restaurante Sabor & Cia</strong><small>Última comunicação: há 3 horas (simulado)</small></div><span className="status-offline">Desconectado</span></div><div className="admin-device"><span className="live-dot"/><div><strong>ESP32-009 · Farmácia Bem Estar</strong><small>Última comunicação: há 1 minuto (simulado)</small></div><span className="status-online">Ativo</span></div></section><section className="panel"><h2>Atividade recente</h2><NoticeList notices={notices.slice(0,4)} setNotices={setNotices}/></section></> : null}
      </main></div> : null}
    {logged && authError ? <div role="alert" className="toast">{authError}</div> : null}
    {toast ? <div className="toast" role="status" aria-live="polite"><AudioLines size={18}/>{toast}<button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={16}/></button></div> : null}
  </div>;
}

function NoticeList({ notices, setNotices }: { notices: Notice[]; setNotices: React.Dispatch<React.SetStateAction<Notice[]>> }) {
  return <div className="notice-list">{notices.length ? notices.map(n => <article className={`notice-item ${n.read ? 'read' : ''}`} key={n.id}><span className="notice-icon"><Bell/></span><div><strong>{n.message}</strong><small>{n.time} · {n.simulated ? 'Evento simulado' : 'Evento real'}</small></div>{!n.read ? <button className="secondary-btn small" onClick={() => setNotices(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}><Check size={15}/> Marcar recebida</button> : <span className="read-label">Recebida</span>}</article>) : <p className="empty-state">Nenhuma notificação registrada.</p>}</div>;
}
