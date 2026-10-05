import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Skeleton } from '../components/ui';
import { Page, SessionUser, api } from '../lib/api';
import { firstName, fmtDate, fmtDay, fmtTime, greeting } from '../lib/format';
import type { Appointment, Campaign, Pet, ProviderItem } from '../lib/types';
import { useLoad } from '../lib/useLoad';

export function Home({ user, unread }: { user: SessionUser; unread: number }) {
  const navigate = useNavigate();
  const next = useLoad(() => api.get<Page<Appointment>>('/appointments?scope=upcoming&limit=1'), []);
  const pets = useLoad(() => api.get<{ data: Pet[] }>('/dev/pets'), []);
  const campaigns = useLoad(() => api.get<Page<Campaign>>('/campaigns?limit=3'), []);
  const providers = useLoad(() => api.get<Page<ProviderItem>>('/search/professionals?limit=4'), []);

  const appointment = next.data?.data[0];

  return (
    <div className="page">
      <header className="home-head">
        <div>
          <span className="muted">{greeting()},</span>
          <h1>{firstName(user.name)}</h1>
        </div>
        <Link to="/notificacoes" className="icon-btn bell" aria-label={`Notificações${unread ? `, ${unread} novas` : ''}`}>
          <Icon name="bell" />
          {unread > 0 && <span className="badge">{unread}</span>}
        </Link>
      </header>

      <Link to="/emergencia" className="emergency-cta">
        <span className="emergency-cta-icon"><Icon name="siren" size={26} /></span>
        <span>
          <strong>Emergência</strong>
          <small>Plantões 24h mais perto, com rota e telefone</small>
        </span>
        <Icon name="chevron" />
      </Link>

      <section>
        <h2 className="section-title">Próxima consulta</h2>
        {next.loading && !next.data ? (
          <Skeleton rows={1} />
        ) : appointment ? (
          <Link to="/consultas" className="card next-card">
            <div className="date-chip">
              <span>{fmtDay(appointment.startsAt)}</span>
              <strong>{fmtTime(appointment.startsAt)}</strong>
            </div>
            <div className="next-text">
              <strong>{appointment.snapshot.serviceName}</strong>
              <span>{appointment.snapshot.petName} com {appointment.snapshot.professionalName}</span>
              <span className="muted small">{appointment.snapshot.modality === 'REMOTE' ? 'Online' : appointment.snapshot.clinicName}</span>
            </div>
          </Link>
        ) : (
          <button type="button" className="card next-card next-empty" onClick={() => navigate('/buscar')}>
            <span className="empty-icon"><Icon name="calendar" /></span>
            <div className="next-text">
              <strong>Nenhuma consulta marcada</strong>
              <span className="muted small">Encontre um veterinário e marque em poucos toques.</span>
            </div>
            <Icon name="chevron" className="muted" />
          </button>
        )}
      </section>

      <section>
        <div className="section-row">
          <h2 className="section-title">Meus pets</h2>
          <Link to="/perfil" className="link small">Ver todos</Link>
        </div>
        <div className="pets-row">
          {(pets.data?.data ?? []).map((p) => (
            <div key={p.id} className="pet-chip">
              <span className={`pet-avatar pet-${p.species.name === 'Gato' ? 'cat' : 'dog'}`}><Icon name="paw" size={20} /></span>
              <span><strong>{p.name}</strong><small>{p.species.name}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-row">
          <h2 className="section-title">Para marcar</h2>
          <Link to="/buscar" className="link small">Buscar</Link>
        </div>
        <div className="quick-grid">
          {(providers.data?.data ?? []).map((p) => (
            <Link key={p.id} to={`/profissionais/${p.id}`} className="card quick-card">
              <strong>{p.name}</strong>
              <span className="muted small">{p.specialty}</span>
              {p.nextAvailableAt ? (
                <span className="quick-next"><Icon name="clock" size={14} /> {fmtDay(p.nextAvailableAt)}, {fmtTime(p.nextAvailableAt)}</span>
              ) : (
                <span className="muted small">Sem horários</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {(campaigns.data?.data.length ?? 0) > 0 && (
        <section>
          <div className="section-row">
            <h2 className="section-title">Campanhas oficiais</h2>
            <Link to="/campanhas" className="link small">Ver todas</Link>
          </div>
          <div className="h-scroll">
            {campaigns.data!.data.map((c) => (
              <Link key={c.id} to="/campanhas" className="card campaign-mini">
                <span className="eyebrow">{c.organization}</span>
                <strong>{c.title}</strong>
                <span className="muted small">Até {fmtDate(c.endsAt)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
