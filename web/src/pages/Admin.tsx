import { useEffect, useState } from 'react';
import { ApiError, Page, api, fmtDateTime } from '../api';
import { Empty, ErrorNote, Loading, Status } from '../components/ui';

interface Request {
  id: string;
  target: string;
  status: string;
  createdAt: string;
  subject: { kind: string; name: string; crmv?: string; city?: string } | null;
}

interface Campaign {
  id: string;
  title: string;
  organization: string;
  status: string;
  sourceStatus: string;
  endsAt: string;
}

export function Admin() {
  const [requests, setRequests] = useState<Page<Request> | null>(null);
  const [campaigns, setCampaigns] = useState<Page<Campaign> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const load = () => {
    api.get<Page<Request>>('/admin/verification-requests').then(setRequests).catch(setError);
    api.get<Page<Campaign>>('/admin/campaigns').then(setCampaigns).catch(setError);
  };
  useEffect(load, []);

  async function decide(r: Request, decision: string) {
    const reason = decision === 'APPROVE' ? undefined : window.prompt('Justificativa (o profissional vai ver):')?.trim();
    if (decision !== 'APPROVE' && !reason) return;
    try {
      await api.post(`/admin/verification-requests/${r.id}/decision`, { decision, ...(reason ? { reason } : {}) });
      load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <>
      <h1>Verificação</h1>
      <ErrorNote error={error} />
      {!requests ? (
        <Loading />
      ) : requests.data.length === 0 ? (
        <Empty title="Fila vazia.">Nenhum profissional ou clínica aguardando análise.</Empty>
      ) : (
        <ul className="appointments">
          {requests.data.map((r) => (
            <li key={r.id} className="card appointment request">
              <div className="what">
                <strong>{r.subject?.name}</strong>
                <span className="muted small">{r.target === 'CLINIC' ? 'Clínica' : `Profissional · CRMV ${r.subject?.crmv}`} · enviado {fmtDateTime(r.createdAt)}</span>
              </div>
              <div className="actions">
                <button className="btn" onClick={() => decide(r, 'APPROVE')}>Aprovar</button>
                <button className="btn btn-ghost" onClick={() => decide(r, 'REQUEST_CHANGES')}>Pedir correção</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Campanhas</h2>
      {!campaigns ? (
        <Loading />
      ) : (
        <table className="table">
          <thead>
            <tr><th>Campanha</th><th>Órgão</th><th>Fonte</th><th>Situação</th></tr>
          </thead>
          <tbody>
            {campaigns.data.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.organization}</td>
                <td>{c.sourceStatus === 'VALID' ? 'Conferida' : c.sourceStatus === 'UNREACHABLE' ? 'Inacessível' : 'Não conferida'}</td>
                <td><Status value={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
