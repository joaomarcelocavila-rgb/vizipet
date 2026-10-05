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

  const [asking, setAsking] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [flash, setFlash] = useState('');

  async function decide(r: Request, decision: string) {
    const trimmed = reason.trim();
    if (decision !== 'APPROVE' && !trimmed) return;
    try {
      await api.post(`/admin/verification-requests/${r.id}/decision`, { decision, ...(decision !== 'APPROVE' ? { reason: trimmed } : {}) });
      setAsking(null);
      setReason('');
      setFlash(decision === 'APPROVE' ? `${r.subject?.name} aprovado(a). O perfil já aparece na busca.` : 'Correção pedida. O profissional recebe a justificativa.');
      load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <>
      <h1>Verificação</h1>
      {flash && <p className="flash">{flash}</p>}
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
                <button className="btn btn-ghost" onClick={() => { setAsking(r.id); setReason(''); }}>Pedir correção</button>
              </div>
              {asking === r.id && (
                <div className="confirm">
                  <label htmlFor={`just-${r.id}`}>
                    Justificativa (o profissional vai ver)
                    <input id={`just-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: foto do CRMV ilegível" autoFocus />
                  </label>
                  <div className="confirm-actions">
                    <button className="btn btn-ghost" onClick={() => setAsking(null)}>Voltar</button>
                    <button className="btn" onClick={() => decide(r, 'REQUEST_CHANGES')} disabled={!reason.trim()}>Enviar pedido de correção</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Campanhas</h2>
      {!campaigns ? (
        <Loading />
      ) : (
        <div className="table-wrap">
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
        </div>
      )}
    </>
  );
}
