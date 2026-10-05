import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Skeleton } from '../components/ui';
import { Page, api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { AuditEntry } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const ACTIONS: Record<string, string> = {
  VERIFICATION_APPROVED: 'Cadastro aprovado',
  VERIFICATION_CHANGES_REQUESTED: 'Correção pedida',
  VERIFICATION_REJECTED: 'Cadastro recusado',
  VERIFICATION_DOCUMENT_VIEWED: 'Documento visualizado',
  PROVIDER_SUSPENDED: 'Cadastro suspenso',
  PROVIDER_REINSTATED: 'Cadastro reativado',
  PROFILE_SUSPENDED: 'Perfil suspenso',
  CAMPAIGN_CREATED: 'Campanha criada',
  CAMPAIGN_UPDATED: 'Campanha editada',
  CAMPAIGN_SUBMITTED: 'Campanha enviada para revisão',
  CAMPAIGN_PUBLISHED: 'Campanha publicada',
  CAMPAIGN_ARCHIVED: 'Campanha arquivada',
  CAMPAIGN_SOURCE_FLAGGED: 'Fonte da campanha fora do ar',
};

const ENTITY: Record<string, string> = { Professional: 'Profissional', Clinic: 'Clínica', Campaign: 'Campanha', VerificationRequest: 'Pedido de análise' };

export function AuditLog() {
  const { data, error, reload } = useLoad(() => api.get<Page<AuditEntry>>('/admin/audit-logs?limit=50'), []);

  return (
    <div className="page">
      <TopBar title="Histórico" sub="Tudo o que a administração fez, com data e motivo" />
      <ErrorNote error={error} onRetry={reload} />
      {!data ? (
        error ? null : <Skeleton rows={4} />
      ) : data.data.length === 0 ? (
        <Empty icon="history" title="Nada registrado ainda." />
      ) : (
        <ol className="timeline">
          {data.data.map((e) => (
            <li key={e.id}>
              <span className="tl-dot"><Icon name="history" size={14} /></span>
              <div>
                <strong>{ACTIONS[e.action] ?? e.action}</strong>
                <span className="muted small">
                  {ENTITY[e.entityType] ?? e.entityType}
                  {typeof e.metadata?.name === 'string' ? ` · ${e.metadata.name}` : ''} · {fmtDateTime(e.createdAt)}
                </span>
                {typeof e.metadata?.reason === 'string' && <span className="small">“{e.metadata.reason}”</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
