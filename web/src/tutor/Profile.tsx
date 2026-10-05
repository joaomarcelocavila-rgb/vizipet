import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { InstallCard } from '../components/Install';
import { TopBar } from '../components/Shell';
import { Avatar, Empty, Skeleton } from '../components/ui';
import { SessionUser, api } from '../lib/api';
import type { Pet } from '../lib/types';
import { useLoad } from '../lib/useLoad';

export function Profile({ user, unread, onLogout }: { user: SessionUser; unread: number; onLogout: () => void }) {
  const pets = useLoad(() => api.get<{ data: Pet[] }>('/dev/pets'), []);

  return (
    <div className="page">
      <TopBar title="Perfil" />
      <section className="profile-head">
        <Avatar name={user.name} tone="sand" size="lg" />
        <div>
          <h2>{user.name}</h2>
          <span className="muted small">Tutor</span>
        </div>
      </section>

      <h3 className="section-title">Meus pets</h3>
      {!pets.data ? (
        <Skeleton rows={2} />
      ) : pets.data.data.length === 0 ? (
        <Empty icon="paw" title="Nenhum pet cadastrado." />
      ) : (
        <ul className="list">
          {pets.data.data.map((p) => (
            <li key={p.id} className="card pet-row">
              <span className={`pet-avatar pet-${p.species.name === 'Gato' ? 'cat' : 'dog'}`}><Icon name="paw" size={20} /></span>
              <div className="grow">
                <strong>{p.name}</strong>
                <span className="muted small">{p.species.name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="section-title">Atalhos</h3>
      <div className="menu">
        <MenuLink to="/notificacoes" icon="bell" label="Notificações" badge={unread} />
        <MenuLink to="/consultas" icon="calendar" label="Minhas consultas" />
        <MenuLink to="/campanhas" icon="megaphone" label="Campanhas oficiais" />
        <MenuLink to="/emergencia" icon="siren" label="Plantões 24h" />
        <InstallCard compact />
        <button type="button" className="menu-item danger" onClick={onLogout}>
          <Icon name="logout" /> <span className="grow">Sair</span>
        </button>
      </div>
    </div>
  );
}

export function MenuLink({ to, icon, label, badge }: { to: string; icon: IconName; label: string; badge?: number }) {
  return (
    <Link to={to} className="menu-item">
      <Icon name={icon} />
      <span className="grow">{label}</span>
      {!!badge && <span className="badge inline">{badge}</span>}
      <Icon name="chevron" size={18} className="muted" />
    </Link>
  );
}
