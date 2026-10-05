import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AdminCampaigns } from './admin/Campaigns';
import { AdminHome } from './admin/Home';
import { AuditLog } from './admin/Audit';
import { Network } from './admin/Network';
import { RequestDetail, VerificationQueue } from './admin/Verification';
import { Account } from './clinic/Account';
import { ClinicEditor, ClinicList } from './clinic/Clinics';
import { ProviderAgenda } from './clinic/Agenda';
import { Services } from './clinic/Services';
import { Slots } from './clinic/Slots';
import { DemoBanner } from './components/DemoBanner';
import { Shell, Tab } from './components/Shell';
import { ToastProvider } from './components/ui';
import { Page, SessionUser, api, isDemo, onUnauthorized, session } from './lib/api';
import { Login } from './Login';
import { Notifications } from './shared/Notifications';
import { Appointments } from './tutor/Appointments';
import { Campaigns } from './tutor/Campaigns';
import { Emergency } from './tutor/Emergency';
import { Home } from './tutor/Home';
import { Profile } from './tutor/Profile';
import { Provider } from './tutor/Provider';
import { Search } from './tutor/Search';

export function App() {
  const [user, setUser] = useState<SessionUser | null>(session.user);
  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    const handler = () => setUser(null);
    onUnauthorized.addEventListener('logout', handler);
    return () => onUnauthorized.removeEventListener('logout', handler);
  }, []);

  const banner = isDemo ? <DemoBanner /> : null;

  return (
    <ToastProvider>
      {!user ? (
        <>
          {banner}
          <Routes>
            <Route path="/entrar" element={<Login onLogin={setUser} />} />
            {/* Emergência funciona sem login: numa urgência ninguém quer criar conta. */}
            <Route path="/emergencia" element={<div className="solo"><Emergency /></div>} />
            <Route path="*" element={<Navigate to="/entrar" replace />} />
          </Routes>
        </>
      ) : user.role === 'TUTOR' ? (
        <TutorApp user={user} banner={banner} onLogout={logout} />
      ) : user.role === 'PROFESSIONAL' ? (
        <ClinicApp user={user} banner={banner} onLogout={logout} />
      ) : (
        <AdminApp user={user} banner={banner} onLogout={logout} />
      )}
    </ToastProvider>
  );
}

interface AreaProps {
  user: SessionUser;
  banner: React.ReactNode;
  onLogout: () => void;
}

/** Conta notificações não lidas e atualiza a cada troca de tela. */
function useUnread() {
  const [unread, setUnread] = useState(0);
  const { pathname } = useLocation();
  useEffect(() => {
    api.get<Page<unknown>>('/notifications?limit=1').then((r) => setUnread(r.meta.unread ?? 0)).catch(() => undefined);
  }, [pathname]);
  return unread;
}

function TutorApp({ user, banner, onLogout }: AreaProps) {
  const unread = useUnread();
  const tabs: Tab[] = [
    { to: '/', label: 'Início', icon: 'home', end: true },
    { to: '/buscar', label: 'Buscar', icon: 'search' },
    { to: '/emergencia', label: 'Emergência', icon: 'siren', urgent: true },
    { to: '/consultas', label: 'Consultas', icon: 'calendar' },
    { to: '/perfil', label: 'Perfil', icon: 'user', badge: unread },
  ];
  return (
    <Shell tabs={tabs} area="Tutor" banner={banner}>
      <Routes>
        <Route path="/" element={<Home user={user} unread={unread} />} />
        <Route path="/buscar" element={<Search />} />
        <Route path="/profissionais/:id" element={<Provider />} />
        <Route path="/emergencia" element={<Emergency />} />
        <Route path="/consultas" element={<Appointments role="TUTOR" />} />
        <Route path="/campanhas" element={<Campaigns />} />
        <Route path="/notificacoes" element={<Notifications />} />
        <Route path="/perfil" element={<Profile user={user} unread={unread} onLogout={onLogout} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function ClinicApp({ user, banner, onLogout }: AreaProps) {
  const unread = useUnread();
  const tabs: Tab[] = [
    { to: '/agenda', label: 'Agenda', icon: 'calendar' },
    { to: '/horarios', label: 'Horários', icon: 'clock' },
    { to: '/clinica', label: 'Clínica', icon: 'building' },
    { to: '/servicos', label: 'Serviços', icon: 'stethoscope' },
    { to: '/conta', label: 'Conta', icon: 'user', badge: unread },
  ];
  return (
    <Shell tabs={tabs} area="Clínica" banner={banner}>
      <Routes>
        <Route path="/agenda" element={<ProviderAgenda user={user} />} />
        <Route path="/horarios" element={<Slots />} />
        <Route path="/clinica" element={<ClinicList />} />
        <Route path="/clinica/nova" element={<ClinicEditor />} />
        <Route path="/clinica/:id" element={<ClinicEditor />} />
        <Route path="/servicos" element={<Services />} />
        <Route path="/conta" element={<Account user={user} unread={unread} onLogout={onLogout} />} />
        <Route path="/notificacoes" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/agenda" replace />} />
      </Routes>
    </Shell>
  );
}

function AdminApp({ user, banner, onLogout }: AreaProps) {
  const tabs: Tab[] = [
    { to: '/admin', label: 'Painel', icon: 'grid', end: true },
    { to: '/admin/verificacao', label: 'Análise', icon: 'shield' },
    { to: '/admin/rede', label: 'Rede', icon: 'building' },
    { to: '/admin/campanhas', label: 'Campanhas', icon: 'megaphone' },
    { to: '/admin/historico', label: 'Histórico', icon: 'history' },
  ];
  return (
    <Shell tabs={tabs} area="Administração" banner={banner}>
      <Routes>
        <Route path="/admin" element={<AdminHome user={user} onLogout={onLogout} />} />
        <Route path="/admin/verificacao" element={<VerificationQueue />} />
        <Route path="/admin/verificacao/:id" element={<RequestDetail />} />
        <Route path="/admin/rede" element={<Network />} />
        <Route path="/admin/campanhas" element={<AdminCampaigns />} />
        <Route path="/admin/historico" element={<AuditLog />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Shell>
  );
}
