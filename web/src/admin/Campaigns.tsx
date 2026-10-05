import { FormEvent, useState } from 'react';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Field, Segmented, Sheet, Skeleton, Status, useToast } from '../components/ui';
import { ApiError, Page, api } from '../lib/api';
import { fmtDate, plusDaysKey, todayKey } from '../lib/format';
import type { Campaign } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const FILTERS = [
  ['', 'Todas'],
  ['DRAFT', 'Rascunho'],
  ['UNDER_REVIEW', 'Revisão'],
  ['PUBLISHED', 'No ar'],
] as const;
type Filter = (typeof FILTERS)[number][0];

const BLANK = { title: '', type: 'VACINACAO', organization: '', audience: '', requirements: '', location: '', startsAt: todayKey(), endsAt: plusDaysKey(30), sourceUrl: 'https://' };

export function AdminCampaigns() {
  const toast = useToast();
  const [status, setStatus] = useState<Filter>('');
  const { data, error, loading, reload } = useLoad(() => api.get<Page<Campaign>>(`/admin/campaigns?limit=50${status ? `&status=${status}` : ''}`), [status]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [formError, setFormError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(c: Campaign, action: 'submit' | 'publish' | 'archive') {
    setActionError(null);
    try {
      await api.post(`/admin/campaigns/${c.id}/${action}`);
      toast(action === 'publish' ? 'Campanha publicada.' : action === 'submit' ? 'Enviada para revisão.' : 'Campanha arquivada.');
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await api.post('/admin/campaigns', {
        ...form,
        startsAt: `${form.startsAt}T00:00:00-03:00`,
        endsAt: `${form.endsAt}T23:59:00-03:00`,
      });
      toast('Rascunho criado.');
      setCreating(false);
      setForm(BLANK);
      reload();
    } catch (err) {
      setFormError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="page">
      <TopBar title="Campanhas" sub="Só publique com fonte oficial conferida" action={<button type="button" className="btn btn-sm" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Nova</button>} />
      <Segmented value={status} options={FILTERS} onChange={setStatus} />
      <ErrorNote error={error ?? actionError} onRetry={error ? reload : undefined} />
      {loading && !data ? (
        <Skeleton rows={3} />
      ) : data?.data.length === 0 ? (
        <Empty icon="megaphone" title="Nenhuma campanha aqui." />
      ) : (
        <ul className="list">
          {data?.data.map((c) => (
            <li key={c.id} className="card campaign">
              <div className="row between">
                <span className="eyebrow">{c.organization}</span>
                <Status value={c.status ?? 'DRAFT'} />
              </div>
              <h3>{c.title}</h3>
              <span className="muted small">{fmtDate(c.startsAt)} a {fmtDate(c.endsAt)} · {c.location}</span>
              <div className="row wrap">
                {c.sourceStatus && <Status value={c.sourceStatus} />}
                <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener" className="link small">Abrir fonte <Icon name="external" size={12} /></a>
              </div>
              <div className="row wrap">
                {c.status === 'DRAFT' && <button type="button" className="btn btn-soft btn-sm" onClick={() => act(c, 'submit')}>Enviar para revisão</button>}
                {c.status === 'UNDER_REVIEW' && <button type="button" className="btn btn-sm" onClick={() => act(c, 'publish')}>Conferi a fonte, publicar</button>}
                {c.status !== 'ARCHIVED' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(c, 'archive')}>Arquivar</button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova campanha"
        footer={<button type="submit" form="campaign-form" className="btn btn-block" disabled={busy}>{busy ? 'Salvando…' : 'Criar rascunho'}</button>}
      >
        <form id="campaign-form" className="form" onSubmit={create}>
          <Field label="Título"><input value={form.title} onChange={set('title')} required minLength={3} /></Field>
          <div className="grid-2">
            <Field label="Tipo">
              <select value={form.type} onChange={set('type')}>
                <option value="VACINACAO">Vacinação</option>
                <option value="CASTRACAO">Castração</option>
                <option value="ADOCAO">Adoção</option>
                <option value="OUTRO">Outro</option>
              </select>
            </Field>
            <Field label="Órgão"><input value={form.organization} onChange={set('organization')} required placeholder="Prefeitura do Recife" /></Field>
          </div>
          <Field label="Quem pode participar"><input value={form.audience} onChange={set('audience')} required /></Field>
          <Field label="Onde"><input value={form.location} onChange={set('location')} required /></Field>
          <Field label="O que levar / requisitos"><textarea rows={2} value={form.requirements} onChange={set('requirements')} required /></Field>
          <div className="grid-2">
            <Field label="Início"><input type="date" value={form.startsAt} onChange={set('startsAt')} required /></Field>
            <Field label="Fim"><input type="date" value={form.endsAt} min={form.startsAt} onChange={set('endsAt')} required /></Field>
          </div>
          <Field label="Link da fonte oficial" hint="Endereço https de site público (gov.br, prefeitura…)"><input type="url" inputMode="url" value={form.sourceUrl} onChange={set('sourceUrl')} required /></Field>
          <ErrorNote error={formError} />
        </form>
      </Sheet>
    </div>
  );
}
