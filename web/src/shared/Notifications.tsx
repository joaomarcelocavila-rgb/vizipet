import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Skeleton } from '../components/ui';
import { Page, api } from '../lib/api';
import { fmtAgo } from '../lib/format';
import type { Notification } from '../lib/types';
import { useLoad } from '../lib/useLoad';

export function Notifications() {
  const { data, error, reload } = useLoad(() => api.get<Page<Notification>>('/notifications?limit=50'), []);

  async function readAll() {
    await api.post('/notifications/read-all');
    reload();
  }

  return (
    <div className="page">
      <TopBar
        title="Notificações"
        back
        action={!!data?.meta.unread && <button type="button" className="link small" onClick={readAll}>Marcar lidas</button>}
      />
      <ErrorNote error={error} onRetry={reload} />
      {!data ? (
        error ? null : <Skeleton rows={3} />
      ) : data.data.length === 0 ? (
        <Empty icon="bell" title="Nenhuma notificação ainda.">Confirmações, lembretes e cancelamentos aparecem aqui.</Empty>
      ) : (
        <ul className="list">
          {data.data.map((n) => (
            <li key={n.id} className={`card notif${n.readAt ? '' : ' unread'}`}>
              <span className={`notif-icon${n.type === 'APPOINTMENT_CANCELLED' ? ' warn' : ''}`}>
                <Icon name={n.type === 'APPOINTMENT_CANCELLED' ? 'alert' : n.type?.includes('REMINDER') ? 'clock' : 'calendar'} size={18} />
              </span>
              <div className="grow">
                <div className="row between">
                  <strong>{n.title}</strong>
                  <span className="muted small">{fmtAgo(n.createdAt)}</span>
                </div>
                <p>{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
