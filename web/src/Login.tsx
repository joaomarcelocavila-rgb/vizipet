import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon, IconName } from './components/Icon';
import { Avatar, ErrorNote, Skeleton } from './components/ui';
import { ApiError, Role, SessionUser, api, session } from './lib/api';

interface SeedUser {
  email: string;
  name: string;
  role: Role;
}

const AREAS: { role: Role; title: string; text: string; icon: IconName }[] = [
  { role: 'TUTOR', title: 'Sou tutor', text: 'Marcar consulta, achar plantão 24h e acompanhar meus pets.', icon: 'paw' },
  { role: 'PROFESSIONAL', title: 'Sou clínica ou veterinário', text: 'Cadastrar a clínica, abrir horários e ver a agenda.', icon: 'building' },
  { role: 'ADMIN', title: 'Administração', text: 'Aprovar cadastros, cuidar das campanhas e da rede.', icon: 'shield' },
];

export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [users, setUsers] = useState<SeedUser[] | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ data: SeedUser[] }>('/dev/users').then((r) => setUsers(r.data)).catch(setError);
  }, []);

  async function enter(email: string) {
    setEntering(email);
    try {
      const res = await api.post<{ data: { accessToken: string; user: SessionUser } }>('/dev/login', { email });
      session.save(res.data.accessToken, res.data.user);
      onLogin(res.data.user);
      navigate(res.data.user.role === 'ADMIN' ? '/admin' : res.data.user.role === 'PROFESSIONAL' ? '/agenda' : '/');
    } catch (e) {
      setError(e as ApiError);
      setEntering(null);
    }
  }

  const area = AREAS.find((a) => a.role === role);
  const list = users?.filter((u) => u.role === role) ?? [];

  return (
    <div className="login">
      <section className="login-hero">
        <span className="logo logo-lg">vizipet</span>
        <h1>Cuidado para o seu pet, do check-up ao plantão.</h1>
        <p>Consultas com horário confirmado na hora e os hospitais 24h mais perto de você.</p>
      </section>

      <Link to="/emergencia" className="emergency-cta">
        <span className="emergency-cta-icon"><Icon name="siren" size={26} /></span>
        <span>
          <strong>Emergência agora?</strong>
          <small>Ver plantões 24h perto de mim, sem login</small>
        </span>
        <Icon name="chevron" />
      </Link>

      <section className="login-panel">
        {!area ? (
          <>
            <h2 className="section-title">Como você quer entrar?</h2>
            <div className="stack">
              {AREAS.map((a) => (
                <button key={a.role} type="button" className="choice" onClick={() => setRole(a.role)}>
                  <span className={`choice-icon choice-${a.role.toLowerCase()}`}><Icon name={a.icon} /></span>
                  <span className="choice-text">
                    <strong>{a.title}</strong>
                    <small>{a.text}</small>
                  </span>
                  <Icon name="chevron" className="muted" />
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button type="button" className="link back-link" onClick={() => setRole(null)}>
              <Icon name="back" size={18} /> Voltar
            </button>
            <h2 className="section-title">{area.title}</h2>
            <p className="muted small">Ambiente de testes: escolha uma conta de exemplo. O login com senha entra junto com o módulo de autenticação.</p>
            {!users ? (
              <Skeleton rows={2} />
            ) : (
              <div className="stack">
                {list.map((u) => (
                  <button key={u.email} type="button" className="choice" onClick={() => enter(u.email)} disabled={!!entering}>
                    <Avatar name={u.name} tone={u.role === 'ADMIN' ? 'ink' : u.role === 'PROFESSIONAL' ? 'green' : 'sand'} />
                    <span className="choice-text">
                      <strong>{u.name}</strong>
                      <small>{u.email}</small>
                    </span>
                    {entering === u.email ? <span className="spinner" /> : <Icon name="chevron" className="muted" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <ErrorNote error={error} />
      </section>
    </div>
  );
}
