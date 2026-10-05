import { ChangeEvent, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorNote, Status, useToast } from '../components/ui';
import { ApiError, api, qs } from '../lib/api';
import { fmtDate } from '../lib/format';
import type { MyVerificationRequest, VerificationDocument, VerificationStatus } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const KIND_LABEL: Record<string, string> = {
  CRMV: 'Carteira do CRMV',
  IDENTITY: 'Documento de identidade',
  CLINIC_LICENSE: 'Alvará ou licença',
  OTHER: 'Outro',
};

const STATUS_TEXT: Record<VerificationStatus, string> = {
  PENDING: 'Envie os documentos e peça a análise. A equipe responde em até 2 dias úteis.',
  APPROVED: 'Tudo certo: aparece na busca e recebe agendamentos.',
  CHANGES_REQUESTED: 'A equipe pediu ajustes. Corrija e envie de novo.',
  REJECTED: 'O cadastro foi recusado. Fale com o suporte se discordar.',
  SUSPENDED: 'Suspenso pela administração. Fale com o suporte.',
};

/** Documentos e pedido de análise de um perfil profissional ou de uma clínica. */
export function VerificationBox({ target, clinicId, status, onChange }: { target: 'PROFESSIONAL' | 'CLINIC'; clinicId?: string; status: VerificationStatus; onChange: () => void }) {
  const toast = useToast();
  const scope = qs({ target, clinicId });
  const docs = useLoad(() => api.get<{ data: VerificationDocument[] }>(`/verification/documents?${scope}`), [scope]);
  const requests = useLoad(() => api.get<{ data: MyVerificationRequest[] }>('/verification/requests/mine'), []);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = (requests.data?.data ?? []).filter((r) => (target === 'CLINIC' ? r.clinicId === clinicId : r.target === 'PROFESSIONAL'));
  const last = mine[0];
  const waiting = last?.status === 'PENDING';
  const kinds = target === 'CLINIC' ? ['CLINIC_LICENSE', 'OTHER'] : ['CRMV', 'IDENTITY', 'OTHER'];

  async function upload(kind: string, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const body = new FormData();
    body.append('file', file);
    body.append('target', target);
    body.append('kind', kind);
    if (clinicId) body.append('clinicId', clinicId);
    try {
      await api.post('/verification/documents', body);
      toast('Documento enviado.');
      docs.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/verification/documents/${id}`);
      docs.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/verification/requests', { target, ...(clinicId ? { clinicId } : {}) });
      toast('Enviado para análise.');
      requests.reload();
      onChange();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card verify">
      <div className="row between">
        <h3>Verificação</h3>
        <Status value={waiting ? 'UNDER_REVIEW' : status === 'PENDING' ? 'NOT_SUBMITTED' : status} />
      </div>
      <p className="muted small">{waiting ? `Em análise desde ${fmtDate(last.createdAt)}.` : STATUS_TEXT[status]}</p>
      {last?.reason && !waiting && last.status !== 'APPROVED' && (
        <div className="note note-warn"><span><strong>Mensagem da equipe:</strong> {last.reason}</span></div>
      )}

      {status !== 'APPROVED' && status !== 'SUSPENDED' && (
        <>
          <ul className="docs">
            {(docs.data?.data ?? []).map((d) => (
              <li key={d.id}>
                <Icon name="file" size={18} />
                <span className="grow">
                  <strong>{KIND_LABEL[d.kind] ?? d.kind}</strong>
                  <small className="muted">{d.originalName}</small>
                </span>
                {!waiting && <button type="button" className="link small" onClick={() => remove(d.id)}>Remover</button>}
              </li>
            ))}
          </ul>
          {!waiting && (
            <div className="upload-row">
              {kinds.map((k) => (
                <label key={k} className="btn btn-soft btn-sm upload">
                  <Icon name="plus" size={16} /> {KIND_LABEL[k]}
                  <input type="file" accept="application/pdf,image/jpeg,image/png" capture={undefined} onChange={(e) => upload(k, e)} hidden />
                </label>
              ))}
            </div>
          )}
          <ErrorNote error={error} />
          {!waiting && (
            <button type="button" className="btn btn-block" onClick={submit} disabled={busy}>
              {busy ? 'Enviando…' : 'Enviar para análise'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
