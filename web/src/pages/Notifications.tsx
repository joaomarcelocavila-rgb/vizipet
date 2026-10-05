import { useEffect, useState } from 'react';
import { Page, api, fmtDateTime } from '../api';
import { Empty, Loading } from '../components/ui';

interface Notification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function Notifications() {
  const [page, setPage] = useState<Page<Notification> | null>(null);

  const load = () => api.get<Page<Notification>>('/notifications').then(setPage);
  useEffect(() => {
    load();
  }, []);

  async function readAll() {
    await api.post('/notifications/read-all');
    load();
  }

  return (
    <>
      <div className="title-row">
        <h1>Notificações</h1>
        {!!page?.meta.unread && <button className="btn btn-ghost" onClick={readAll}>Marcar todas como lidas</button>}
      </div>
      {!page ? (
        <Loading />
      ) : page.data.length === 0 ? (
        <Empty title="Nenhuma notificação ainda." />
      ) : (
        <ul className="notifications">
          {page.data.map((n) => (
            <li key={n.id} className={`card notification ${n.readAt ? '' : 'unread'}`}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <span className="muted small">{fmtDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
