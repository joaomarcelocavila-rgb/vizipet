import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, SessionUser, api, session } from '../api';
import { ErrorNote } from '../components/ui';

interface SeedUser {
  email: string;
  name: string;
  role: SessionUser['role'];
}

const DESCRIPTION = {
  TUTOR: 'Busca veterinários, agenda e acompanha consultas do Luna e do Mingau.',
  PROFESSIONAL: 'Vê a própria agenda, gera horários e cancela com motivo.',
  ADMIN: 'Analisa pedidos de verificação e cuida das campanhas.',
};

export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [users, setUsers] = useState<SeedUser[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<{ data: SeedUser[] }>('/dev/users').then((r) => setUsers(r.data)).catch(setError);
  }, []);

  async function enter(email: string) {
    try {
      const res = await api.post<{ data: { accessToken: string; user: SessionUser } }>('/dev/login', { email });
      session.save(res.data.accessToken, res.data.user);
      onLogin(res.data.user);
      navigate('/');
    } catch (e) {
      setError(e as ApiError);
    }
  }

  const order = ['TUTOR', 'PROFESSIONAL', 'ADMIN'];
  const sorted = [...users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));

  return (
    <div className="login">
      <div className="login-intro">
        <span className="logo logo-lg">vizipet</span>
        <h1>Cuidado veterinário perto de você, com horário confirmado na hora.</h1>
        <p className="muted">
          Ambiente de desenvolvimento. O login de verdade ainda vai entrar; por enquanto escolha um usuário de teste.
        </p>
      </div>
      <div className="login-list">
        {sorted.map((u) => (
          <button key={u.email} className="login-card" onClick={() => enter(u.email)}>
            <span className={`avatar avatar-${u.role.toLowerCase()}`}>{u.name.replace(/^(Dra?\.)\s*/, '').charAt(0)}</span>
            <span>
              <strong>{u.name}</strong>
              <small>{DESCRIPTION[u.role]}</small>
            </span>
          </button>
        ))}
        <ErrorNote error={error} />
      </div>
    </div>
  );
}
