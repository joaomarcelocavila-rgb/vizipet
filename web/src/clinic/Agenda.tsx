import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Note } from '../components/ui';
import { Page, SessionUser, api } from '../lib/api';
import { dayKey, firstName, fmtTime, greeting, todayKey } from '../lib/format';
import type { Appointment, OwnedProfessional } from '../lib/types';
import { useLoad } from '../lib/useLoad';
import { AppointmentList } from '../tutor/Appointments';

export function ProviderAgenda({ user }: { user: SessionUser }) {
  const upcoming = useLoad(() => api.get<Page<Appointment>>('/appointments?scope=upcoming&limit=50'), []);
  const me = useLoad(() => api.get<{ data: OwnedProfessional }>('/professionals/me').catch(() => null), []);

  const today = (upcoming.data?.data ?? []).filter((a) => dayKey(a.startsAt) === todayKey());
  const next = upcoming.data?.data[0];
  const status = me.data?.data.verificationStatus;

  return (
    <div className="page">
      <TopBar title={`${greeting()}, ${firstName(user.name)}`} sub="Agenda da clínica" />

      {me.data === null && !me.loading && (
        <Note tone="warn">
          Complete seu perfil profissional para aparecer na busca. <Link to="/conta" className="link">Completar agora</Link>
        </Note>
      )}
      {status && status !== 'APPROVED' && (
        <Note tone="warn">
          Seu cadastro ainda não está aprovado, então tutores não te encontram na busca. <Link to="/conta" className="link">Ver situação</Link>
        </Note>
      )}

      <div className="stats">
        <div className="stat">
          <span className="stat-value">{upcoming.data ? today.length : '–'}</span>
          <span className="stat-label">consultas hoje</span>
        </div>
        <div className="stat">
          <span className="stat-value">{upcoming.data ? upcoming.data.meta.total : '–'}</span>
          <span className="stat-label">próximas</span>
        </div>
        <div className="stat">
          <span className="stat-value small-value">{next ? fmtTime(next.startsAt) : '–'}</span>
          <span className="stat-label">{next ? (dayKey(next.startsAt) === todayKey() ? 'próxima, hoje' : 'próxima') : 'sem próximas'}</span>
        </div>
      </div>

      <div className="row">
        <Link to="/horarios" className="btn btn-soft grow"><Icon name="plus" size={18} /> Abrir horários</Link>
        <Link to="/clinica" className="btn btn-soft grow"><Icon name="building" size={18} /> Minha clínica</Link>
      </div>

      <AppointmentList role="PROFESSIONAL" />
    </div>
  );
}
