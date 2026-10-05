import { useState } from 'react';
import { TopBar } from '../components/Shell';
import { Avatar, Empty, ErrorNote, Field, Segmented, Sheet, Skeleton, useToast } from '../components/ui';
import { ApiError, Page, api, qs } from '../lib/api';
import { fmtAgo, fmtPhone } from '../lib/format';
import type { AuditEntry, ProviderItem, PublicClinic } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const TABS = [
  ['clinics', 'Clínicas'],
  ['professionals', 'Profissionais'],
  ['suspended', 'Suspensos'],
] as const;
type TabKey = (typeof TABS)[number][0];

interface Target {
  kind: 'clinics' | 'professionals';
  id: string;
  name: string;
  action: 'suspend' | 'reinstate';
}

export function Network() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('clinics');
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const clinics = useLoad(() => (tab === 'clinics' ? api.get<Page<PublicClinic>>(`/search/clinics?${qs({ q, limit: 50 })}`) : Promise.resolve(null)), [tab, q]);
  const pros = useLoad(() => (tab === 'professionals' ? api.get<Page<ProviderItem>>(`/search/professionals?${qs({ q, limit: 50, sort: 'name' })}`) : Promise.resolve(null)), [tab, q]);
  const audit = useLoad(() => (tab === 'suspended' ? api.get<Page<AuditEntry>>('/admin/audit-logs?limit=50') : Promise.resolve(null)), [tab]);

  // O último evento de cada cadastro diz se ele continua suspenso.
  const suspended: Target[] = [];
  const seen = new Set<string>();
  for (const e of audit.data?.data ?? []) {
    if (e.action !== 'PROVIDER_SUSPENDED' && e.action !== 'PROVIDER_REINSTATED') continue;
    if (seen.has(e.entityId)) continue;
    seen.add(e.entityId);
    if (e.action === 'PROVIDER_SUSPENDED') {
      suspended.push({
        kind: e.entityType === 'Clinic' ? 'clinics' : 'professionals',
        id: e.entityId,
        name: (e.metadata?.name as string) ?? `Cadastro ${e.entityId.slice(0, 8)}`,
        action: 'reinstate',
      });
    }
  }

  async function confirm() {
    if (!target || reason.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/admin/${target.kind}/${target.id}/${target.action}`, { reason: reason.trim() });
      toast(target.action === 'suspend' ? `${target.name} suspenso. Saiu da busca e da emergência.` : `${target.name} reativado.`);
      setTarget(null);
      clinics.reload();
      pros.reload();
      audit.reload();
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const loading = (tab === 'clinics' && !clinics.data) || (tab === 'professionals' && !pros.data) || (tab === 'suspended' && !audit.data);

  return (
    <div className="page">
      <TopBar title="Rede" sub="Cadastros aprovados que aparecem no app" />
      <Segmented value={tab} options={TABS} onChange={(t) => { setTab(t); setQ(''); }} />
      {tab !== 'suspended' && (
        <div className="searchbar">
          <input type="search" placeholder="Filtrar por nome ou cidade" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar" />
        </div>
      )}
      <ErrorNote error={clinics.error ?? pros.error ?? audit.error} />
      {loading ? (
        <Skeleton rows={3} />
      ) : tab === 'clinics' ? (
        clinics.data!.data.length === 0 ? <Empty icon="building" title="Nenhuma clínica aprovada." /> : (
          <ul className="list">
            {clinics.data!.data.map((c) => (
              <li key={c.id} className="card net-row">
                <Avatar name={c.name} tone="sand" />
                <div className="grow">
                  <strong>{c.name}</strong>
                  <span className="muted small">{c.city} · {c.phone ? fmtPhone(c.phone) : 'sem telefone'}</span>
                  {c.emergency24h && <span className="pill pill-danger small-pill">Plantão 24h</span>}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTarget({ kind: 'clinics', id: c.id, name: c.name, action: 'suspend' }); setReason(''); setError(null); }}>Suspender</button>
              </li>
            ))}
          </ul>
        )
      ) : tab === 'professionals' ? (
        pros.data!.data.length === 0 ? <Empty icon="stethoscope" title="Nenhum profissional aprovado." /> : (
          <ul className="list">
            {pros.data!.data.map((p) => (
              <li key={p.id} className="card net-row">
                <Avatar name={p.name} />
                <div className="grow">
                  <strong>{p.name}</strong>
                  <span className="muted small">CRMV {p.crmv} · {p.city ?? 'online'}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setTarget({ kind: 'professionals', id: p.id, name: p.name, action: 'suspend' }); setReason(''); setError(null); }}>Suspender</button>
              </li>
            ))}
          </ul>
        )
      ) : suspended.length === 0 ? (
        <Empty icon="shield" title="Nenhum cadastro suspenso." />
      ) : (
        <ul className="list">
          {suspended.map((s) => (
            <li key={s.id} className="card net-row">
              <Avatar name={s.name} tone="red" />
              <div className="grow">
                <strong>{s.name}</strong>
                <span className="muted small">{s.kind === 'clinics' ? 'Clínica' : 'Profissional'} · suspenso {fmtAgo(audit.data!.data.find((e) => e.entityId === s.id)!.createdAt)}</span>
              </div>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => { setTarget(s); setReason(''); setError(null); }}>Reativar</button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!target}
        onClose={() => setTarget(null)}
        title={target?.action === 'suspend' ? `Suspender ${target?.name}` : `Reativar ${target?.name}`}
        footer={
          <button type="button" className={`btn btn-block${target?.action === 'suspend' ? ' btn-danger' : ''}`} onClick={confirm} disabled={busy || reason.trim().length < 5}>
            {target?.action === 'suspend' ? 'Suspender' : 'Reativar'}
          </button>
        }
      >
        {target?.action === 'suspend' && <p>O cadastro some da busca e da tela de emergência na hora. As consultas já marcadas continuam.</p>}
        <Field label="Motivo" hint="Mínimo de 5 caracteres. Fica no histórico e o responsável é avisado.">
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorNote error={error} />
      </Sheet>
    </div>
  );
}
