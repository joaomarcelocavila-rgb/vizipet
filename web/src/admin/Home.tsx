import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Avatar, Note } from '../components/ui';
import { Page, SessionUser, api } from '../lib/api';
import { firstName, fmtAgo, greeting } from '../lib/format';
import type { AdminRequest, Campaign, PublicClinic } from '../lib/types';
import { useLoad } from '../lib/useLoad';

export function AdminHome({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const pending = useLoad(() => api.get<Page<AdminRequest>>('/admin/verification-requests?status=PENDING&limit=5'), []);
  const review = useLoad(() => api.get<Page<Campaign>>('/admin/campaigns?status=UNDER_REVIEW&limit=1'), []);
  const live = useLoad(() => api.get<Page<Campaign>>('/campaigns?limit=1'), []);
  const er = useLoad(() => api.get<Page<PublicClinic>>('/search/clinics?emergency=true&limit=1'), []);
  const clinics = useLoad(() => api.get<Page<PublicClinic>>('/search/clinics?limit=1'), []);

  const n = (p: { data: Page<unknown> | null }) => (p.data ? p.data.meta.total : '–');

  return (
    <div className="page">
      <TopBar title={`${greeting()}, ${firstName(user.name)}`} sub="Administração geral" action={<button type="button" className="icon-btn" onClick={onLogout} aria-label="Sair"><Icon name="logout" /></button>} />

      <div className="stats stats-4">
        <Stat to="/admin/verificacao" icon="shield" value={n(pending)} label="aguardando análise" highlight={!!pending.data?.meta.total} />
        <Stat to="/admin/campanhas" icon="megaphone" value={n(review)} label="campanhas em revisão" />
        <Stat to="/admin/campanhas" icon="check" value={n(live)} label="campanhas no ar" />
        <Stat to="/admin/rede" icon="building" value={n(clinics)} label={`clínicas · ${n(er)} com plantão 24h`} />
      </div>

      {er.data && er.data.meta.total === 0 && (
        <Note tone="warn">Nenhuma clínica 24h aprovada: a tela de emergência dos tutores está vazia.</Note>
      )}

      <div className="section-row">
        <h2 className="section-title">Fila de análise</h2>
        <Link to="/admin/verificacao" className="link small">Ver tudo</Link>
      </div>
      {pending.data?.data.length === 0 ? (
        <p className="muted small">Fila vazia. Nenhum cadastro aguardando.</p>
      ) : (
        <ul className="list">
          {(pending.data?.data ?? []).map((r) => (
            <li key={r.id}>
              <Link to={`/admin/verificacao/${r.id}`} className="card req-card">
                <Avatar name={r.subject?.name ?? '?'} tone={r.target === 'CLINIC' ? 'sand' : 'green'} />
                <div className="grow">
                  <strong>{r.subject?.name}</strong>
                  <span className="muted small">{r.target === 'CLINIC' ? 'Clínica' : 'Profissional'} · {fmtAgo(r.createdAt)}</span>
                </div>
                <Icon name="chevron" className="muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ to, icon, value, label, highlight }: { to: string; icon: IconName; value: number | string; label: string; highlight?: boolean }) {
  return (
    <Link to={to} className={`stat stat-link${highlight ? ' highlight' : ''}`}>
      <Icon name={icon} size={18} />
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </Link>
  );
}
