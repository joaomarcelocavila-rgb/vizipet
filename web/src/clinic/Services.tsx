import { FormEvent, useState } from 'react';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Field, Segmented, Sheet, Skeleton, Toggle, useToast } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { modalityLabel, money } from '../lib/format';
import type { OwnedService, Species } from '../lib/types';
import { useLoad } from '../lib/useLoad';

interface Form {
  name: string;
  description: string;
  modality: 'IN_PERSON' | 'REMOTE';
  durationMinutes: string;
  price: string;
  speciesIds: string[];
  active: boolean;
}

const BLANK: Form = { name: '', description: '', modality: 'IN_PERSON', durationMinutes: '30', price: '', speciesIds: [], active: true };

export function Services() {
  const toast = useToast();
  const services = useLoad(() => api.get<{ data: OwnedService[] }>('/services/mine'), []);
  const species = useLoad(() => api.get<{ data: Species[] }>('/species'), []);
  const [editing, setEditing] = useState<OwnedService | 'new' | null>(null);
  const [form, setForm] = useState<Form>(BLANK);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const speciesName = (id: string) => species.data?.data.find((s) => s.id === id)?.name ?? '';

  function open(s: OwnedService | 'new') {
    setError(null);
    setEditing(s);
    setForm(
      s === 'new'
        ? { ...BLANK, speciesIds: species.data?.data.map((x) => x.id) ?? [] }
        : {
            name: s.name,
            description: s.description ?? '',
            modality: s.modality,
            durationMinutes: String(s.durationMinutes),
            price: s.priceCents === null ? '' : (s.priceCents / 100).toFixed(2).replace('.', ','),
            speciesIds: s.speciesIds,
            active: s.active,
          },
    );
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const price = form.price.trim() ? Math.round(Number(form.price.replace(/\./g, '').replace(',', '.')) * 100) : undefined;
    const body = {
      name: form.name.trim(),
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      modality: form.modality,
      durationMinutes: Number(form.durationMinutes),
      ...(price !== undefined && !Number.isNaN(price) ? { priceCents: price } : {}),
      speciesIds: form.speciesIds,
      ...(editing !== 'new' ? { active: form.active } : {}),
    };
    try {
      if (editing === 'new') await api.post('/services', body);
      else if (editing) await api.patch(`/services/${editing.id}`, body);
      toast(editing === 'new' ? 'Serviço criado.' : 'Serviço atualizado.');
      setEditing(null);
      services.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  const toggleSpecies = (id: string) =>
    setForm((f) => ({ ...f, speciesIds: f.speciesIds.includes(id) ? f.speciesIds.filter((x) => x !== id) : [...f.speciesIds, id] }));

  return (
    <div className="page">
      <TopBar title="Serviços" sub="O que os tutores podem agendar" action={<button type="button" className="btn btn-sm" onClick={() => open('new')}><Icon name="plus" size={16} /> Novo</button>} />
      <ErrorNote error={services.error} onRetry={services.reload} />
      {!services.data ? (
        services.error ? null : <Skeleton rows={2} />
      ) : services.data.data.length === 0 ? (
        <Empty icon="stethoscope" title="Nenhum serviço cadastrado." action={<button type="button" className="btn" onClick={() => open('new')}>Criar serviço</button>}>
          Ex.: consulta clínica, vacinação, banho terapêutico.
        </Empty>
      ) : (
        <ul className="list">
          {services.data.data.map((s) => (
            <li key={s.id}>
              <button type="button" className={`card service-card${s.active ? '' : ' inactive'}`} onClick={() => open(s)}>
                <div className="grow">
                  <strong>{s.name}</strong>
                  <span className="muted small">
                    {modalityLabel(s.modality)} · {s.durationMinutes} min · {s.speciesIds.map(speciesName).join(', ')}
                  </span>
                </div>
                <div className="service-side">
                  <span className="price">{money(s.priceCents)}</span>
                  {!s.active && <span className="pill pill-neutral">Pausado</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Novo serviço' : 'Editar serviço'}
        footer={<button type="submit" form="service-form" className="btn btn-block" disabled={busy || form.speciesIds.length === 0}>{busy ? 'Salvando…' : 'Salvar'}</button>}
      >
        <form id="service-form" className="form" onSubmit={save}>
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} /></Field>
          <div className="field">
            <span className="field-label">Atendimento</span>
            <Segmented value={form.modality} options={[['IN_PERSON', 'Presencial'], ['REMOTE', 'Online']] as const} onChange={(v) => setForm({ ...form, modality: v })} />
          </div>
          <div className="grid-2">
            <Field label="Duração (min)"><input type="number" inputMode="numeric" min={5} max={480} step={5} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} required /></Field>
            <Field label="Preço (R$)" hint="Vazio = a combinar"><input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="150,00" pattern="[0-9.]*,?[0-9]{0,2}" /></Field>
          </div>
          <div className="field">
            <span className="field-label">Atende</span>
            <div className="chips">
              {(species.data?.data ?? []).map((s) => (
                <button key={s.id} type="button" className={`chip${form.speciesIds.includes(s.id) ? ' active' : ''}`} aria-pressed={form.speciesIds.includes(s.id)} onClick={() => toggleSpecies(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <Field label="Descrição (opcional)"><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={1000} /></Field>
          {editing !== 'new' && <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Disponível para agendamento" hint="Pausado some da busca, mas mantém o histórico." />}
          <ErrorNote error={error} />
        </form>
      </Sheet>
    </div>
  );
}
