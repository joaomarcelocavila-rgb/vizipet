import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Avatar, Empty, ErrorNote, Field, Segmented, Sheet, Skeleton, Status, missingLabel, useToast } from '../components/ui';
import { ApiError, Page, api } from '../lib/api';
import { fmtAgo, fmtDateTime } from '../lib/format';
import type { AdminRequest } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const FILTERS = [
  ['PENDING', 'Pendentes'],
  ['CHANGES_REQUESTED', 'Correção'],
  ['APPROVED', 'Aprovados'],
  ['REJECTED', 'Recusados'],
] as const;
type Filter = (typeof FILTERS)[number][0];

export function VerificationQueue() {
  const [status, setStatus] = useState<Filter>('PENDING');
  const { data, error, loading, reload } = useLoad(() => api.get<Page<AdminRequest>>(`/admin/verification-requests?status=${status}&limit=50`), [status]);

  return (
    <div className="page">
      <TopBar title="Análise de cadastros" sub="Clínicas e profissionais" />
      <Segmented value={status} options={FILTERS} onChange={setStatus} />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Skeleton rows={3} />
      ) : data?.data.length === 0 ? (
        <Empty icon="shield" title={status === 'PENDING' ? 'Fila vazia.' : 'Nada nesta lista.'}>
          {status === 'PENDING' ? 'Nenhum cadastro aguardando análise.' : null}
        </Empty>
      ) : (
        <ul className="list">
          {data?.data.map((r) => (
            <li key={r.id}>
              <Link to={`/admin/verificacao/${r.id}`} className="card req-card">
                <Avatar name={r.subject?.name ?? '?'} tone={r.target === 'CLINIC' ? 'sand' : 'green'} />
                <div className="grow">
                  <strong>{r.subject?.name}</strong>
                  <span className="muted small">
                    {r.target === 'CLINIC' ? `Clínica · ${r.subject?.city ?? ''}` : `Profissional · CRMV ${r.subject?.crmv}`}
                  </span>
                  <span className="muted small">Enviado {fmtAgo(r.createdAt)}</span>
                </div>
                <Status value={r.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const KIND: Record<string, string> = { CRMV: 'Carteira do CRMV', IDENTITY: 'Identidade', CLINIC_LICENSE: 'Alvará', OTHER: 'Outro' };

type Decision = 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';

export function RequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.get<{ data: AdminRequest }>(`/admin/verification-requests/${id}`), [id]);
  const [asking, setAsking] = useState<Decision | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const r = data?.data;

  async function decide(decision: Decision) {
    const trimmed = reason.trim();
    if (decision !== 'APPROVE' && trimmed.length < 5) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/admin/verification-requests/${id}/decision`, { decision, ...(trimmed ? { reason: trimmed } : {}) });
      toast(decision === 'APPROVE' ? `${r?.subject?.name} aprovado. Já aparece no app.` : decision === 'REJECT' ? 'Cadastro recusado.' : 'Correção pedida.');
      navigate('/admin/verificacao');
    } catch (e) {
      setActionError(e as ApiError);
      setBusy(false);
    }
  }

  async function openDocument(docId: string) {
    // Abre a aba já no toque (bloqueadores de pop-up) e aponta para o link curto depois.
    const tab = window.open('', '_blank');
    try {
      const res = await api.post<{ data: { url: string } }>(`/admin/verification-requests/${id}/documents/${docId}/link`);
      if (tab) tab.location.href = res.data.url;
      else window.location.href = res.data.url;
    } catch (e) {
      tab?.close();
      setActionError(e as ApiError);
    }
  }

  if (!r) {
    return (
      <div className="page">
        <TopBar title="Cadastro" back="/admin/verificacao" />
        {error ? <ErrorNote error={error} onRetry={reload} /> : <Skeleton rows={4} />}
      </div>
    );
  }

  const s = r.subject;
  const pending = r.status === 'PENDING';

  return (
    <div className={`page${pending ? ' has-cta' : ''}`}>
      <TopBar title={s?.name ?? 'Cadastro'} back="/admin/verificacao" sub={r.target === 'CLINIC' ? 'Clínica' : 'Profissional'} />
      <section className="profile-head">
        <Avatar name={s?.name ?? '?'} tone={r.target === 'CLINIC' ? 'sand' : 'green'} size="lg" />
        <div>
          <h2>{s?.name}</h2>
          <Status value={r.status} />
        </div>
      </section>

      <dl className="summary card">
        {r.target === 'CLINIC' ? (
          <>
            <dt>Cidade</dt><dd>{s?.city}/{s?.state}</dd>
            <dt>Responsável</dt><dd>{s?.responsibleVet ?? '—'}</dd>
            <dt>CRMV</dt><dd>{s?.responsibleCrmv ?? '—'}</dd>
          </>
        ) : (
          <>
            <dt>CRMV</dt><dd>{s?.crmv}</dd>
            <dt>Cidade</dt><dd>{s?.city ?? '—'}</dd>
          </>
        )}
        <dt>Enviado</dt><dd>{fmtDateTime(r.createdAt)}</dd>
        {r.decidedAt && <><dt>Decidido</dt><dd>{fmtDateTime(r.decidedAt)}</dd></>}
        {r.reason && <><dt>Justificativa</dt><dd>{r.reason}</dd></>}
      </dl>

      {r.missing && r.missing.length > 0 && (
        <div className="note note-warn">
          <Icon name="alert" size={18} />
          <span>Ainda falta: {r.missing.map(missingLabel).join(', ')}. Não dá para aprovar assim.</span>
        </div>
      )}

      <h3 className="section-title">Documentos</h3>
      {(r.documents ?? []).length === 0 ? (
        <p className="muted small">Nenhum documento enviado.</p>
      ) : (
        <ul className="docs card">
          {r.documents!.map((d) => (
            <li key={d.id}>
              <Icon name="file" size={18} />
              <span className="grow">
                <strong>{d.originalName}</strong>
                <small className="muted">{KIND[d.kind] ?? d.kind} · {Math.round(d.sizeBytes / 1024)} KB</small>
              </span>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => openDocument(d.id)}>Ver</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">Cada visualização de documento fica registrada no histórico.</p>
      {!asking && <ErrorNote error={actionError} />}

      {pending && (
        <div className="cta-bar cta-decision">
          <button type="button" className="btn btn-ghost" onClick={() => { setAsking('REJECT'); setReason(''); }}>Recusar</button>
          <button type="button" className="btn btn-soft" onClick={() => { setAsking('REQUEST_CHANGES'); setReason(''); }}>Pedir correção</button>
          <button type="button" className="btn" onClick={() => decide('APPROVE')} disabled={busy || (r.missing?.length ?? 0) > 0}>Aprovar</button>
        </div>
      )}

      <Sheet
        open={!!asking}
        onClose={() => setAsking(null)}
        title={asking === 'REJECT' ? 'Recusar cadastro' : 'Pedir correção'}
        footer={
          <button type="button" className={`btn btn-block${asking === 'REJECT' ? ' btn-danger' : ''}`} disabled={busy || reason.trim().length < 5} onClick={() => asking && decide(asking)}>
            {asking === 'REJECT' ? 'Recusar' : 'Enviar pedido'}
          </button>
        }
      >
        <Field label="Justificativa" hint="Mínimo de 5 caracteres. O solicitante recebe esta mensagem.">
          <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: foto do CRMV ilegível" autoFocus />
        </Field>
        <ErrorNote error={actionError} />
      </Sheet>
    </div>
  );
}
