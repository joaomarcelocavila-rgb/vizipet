import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Page, SessionUser, api, isDemo, session } from './api';
import { DemoBanner } from './components/DemoBanner';
import { Admin } from './pages/Admin';
import { Agenda } from './pages/Agenda';
import { Campaigns } from './pages/Campaigns';
import { Login } from './pages/Login';
import { Notifications } from './pages/Notifications';
import { Professional } from './pages/Professional';
import { Search } from './pages/Search';
import { Slots } from './pages/Slots';

const ROLE_LABEL = { TUTOR: 'Tutor', PROFESSIONAL: 'Veterinário', ADMIN: 'Administração' };

export function App() {
  const [user, setUser] = useState<SessionUser | null>(session.user);
  const location = useLocation();

  if (!user) {
    return (
      <>
      {isDemo && <DemoBanner />}
      <Routes>
        <Route path="/entrar" element={<Login onLogin={setUser} />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
      </>
    );
  }

  const home = user.role === 'ADMIN' ? '/admin' : user.role === 'PROFESSIONAL' ? '/agenda' : '/';

  return (
    <div className="shell">
      {isDemo && <DemoBanner />}
      <Header user={user} onLogout={() => { session.clear(); setUser(null); }} key={location.pathname} />
      <main className="main">
        <Routes>
          {user.role === 'TUTOR' && <Route path="/" element={<Search />} />}
          <Route path="/profissionais/:id" element={<Professional />} />
          <Route path="/agenda" element={<Agenda role={user.role} />} />
          <Route path="/notificacoes" element={<Notifications />} />
          <Route path="/campanhas" element={<Campaigns />} />
          {user.role === 'PROFESSIONAL' && <Route path="/horarios" element={<Slots />} />}
          {user.role === 'ADMIN' && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </main>
      <footer className="footer">Vizipet · horários no fuso de Recife (UTC−3)</footer>
    </div>
  );
}

function Header({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Page<unknown>>('/notifications?limit=1').then((r) => setUnread(r.meta.unread ?? 0)).catch(() => undefined);
  }, []);

  return (
    <header className="header">
      <Link to="/" className="logo">vizipet</Link>
      <nav className="nav">
        {user.role === 'TUTOR' && <NavLink to="/" end>Buscar</NavLink>}
        {user.role !== 'ADMIN' && <NavLink to="/agenda">Agenda</NavLink>}
        {user.role === 'PROFESSIONAL' && <NavLink to="/horarios">Horários</NavLink>}
        {user.role === 'ADMIN' && <NavLink to="/admin">Verificação</NavLink>}
        <NavLink to="/campanhas">Campanhas</NavLink>
      </nav>
      <div className="who">
        <button className="bell" onClick={() => navigate('/notificacoes')} aria-label="Notificações">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && <span className="badge">{unread}</span>}
        </button>
        <div className="who-text">
          <strong>{user.name}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
        </div>
        <button className="link" onClick={onLogout}>Sair</button>
      </div>
    </header>
  );
}
