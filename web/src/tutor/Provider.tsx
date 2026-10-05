import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Avatar, Empty, ErrorNote, Field, Sheet, Skeleton, useToast } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { dayKey, fmtDateTime, fmtDay, fmtPhone, fmtTime, modalityLabel, money } from '../lib/format';
import { mapsRoute, telHref } from '../lib/geo';
import type { Pet, ProviderItem, Slot } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function Provider() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const provider = useLoad(() => api.get<{ data: ProviderItem }>(`/search/professionals/${id}`), [id]);
  const pets = useLoad(() => api.get<{ data: Pet[] }>('/dev/pets'), []);
  const [serviceId, setServiceId] = useState('');
  const [day, setDay] = useState('');
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [petId, setPetId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const p = provider.data?.data;
  useEffect(() => {
    if (p && !serviceId) setServiceId(p.services[0]?.id ?? '');
  }, [p, serviceId]);

  const slots = useLoad(
    () => (serviceId ? api.get<{ data: Slot[] }>(`/search/professionals/${id}/slots?serviceId=${serviceId}`) : Promise.resolve({ data: [] as Slot[] })),
    [id, serviceId],
  );

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.data?.data ?? []) map.set(dayKey(s.startsAt), [...(map.get(dayKey(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [slots.data]);

  useEffect(() => {
    if (days.length && !days.some(([k]) => k === day)) setDay(days[0][0]);
  }, [days, day]);

  const service = p?.services.find((s) => s.id === serviceId);
  const compatible = (pets.data?.data ?? []).filter((pet) => service?.species.some((s) => s.id === pet.species.id));
  const daySlots = days.find(([k]) => k === day)?.[1] ?? [];

  function choose(slot: Slot) {
    setChosen(slot);
    setError(null);
    setPetId(compatible[0]?.id ?? '');
    // Uma chave por tentativa: toques repetidos em "Confirmar" reaproveitam a mesma.
    setIdempotencyKey(newKey());
  }

  async function confirm() {
    if (!chosen || !p) return;
    setSending(true);
    setError(null);
    try {
      await api.post(
        '/appointments',
        { petId, serviceId, professionalId: p.id, slotId: chosen.id, ...(chosen.clinicId ? { clinicId: chosen.clinicId } : {}) },
        { 'Idempotency-Key': idempotencyKey },
      );
      toast('Consulta confirmada!');
      navigate('/consultas');
    } catch (e) {
      setError(e as ApiError);
      setSending(false);
      if ((e as ApiError).code === 'SLOT_NOT_AVAILABLE') slots.reload();
    }
  }

  if (!p) {
    return (
      <div className="page">
        <TopBar title="Profissional" back />
        {provider.error ? <ErrorNote error={provider.error} onRetry={provider.reload} /> : <Skeleton rows={4} />}
      </div>
    );
  }

  const clinic = p.clinics.find((c) => c.id === chosen?.clinicId) ?? p.clinics[0];

  return (
    <div className="page has-cta">
      <TopBar title="Agendar consulta" back />
      <section className="profile-head">
        <Avatar name={p.name} size="lg" />
        <div>
          <h2>{p.name}</h2>
          <p className="muted small">{p.specialty} · CRMV {p.crmv}</p>
          <span className="pill pill-ok"><Icon name="shield" size={14} /> Cadastro verificado</span>
        </div>
      </section>
      {p.bio && <p>{p.bio}</p>}

      {clinic && service?.modality !== 'REMOTE' && (
        <div className="card place-card">
          <Icon name="building" />
          <div className="grow">
            <strong>{clinic.name}</strong>
            <span className="muted small">{clinic.address}</span>
            {clinic.emergency24h && <span className="pill pill-danger small-pill">Plantão 24h</span>}
          </div>
          <div className="place-actions">
            {clinic.phone && <a className="icon-btn" href={telHref(clinic.phone)} aria-label={`Ligar ${fmtPhone(clinic.phone)}`}><Icon name="phone" /></a>}
            <a className="icon-btn" href={mapsRoute(clinic)} target="_blank" rel="noreferrer noopener" aria-label="Como chegar"><Icon name="route" /></a>
          </div>
        </div>
      )}

      <h3 className="section-title">Serviço</h3>
      <div className="stack">
        {p.services.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`option${s.id === serviceId ? ' active' : ''}`}
            onClick={() => { setServiceId(s.id); setChosen(null); setDay(''); }}
            aria-pressed={s.id === serviceId}
          >
            <span className="grow">
              <strong>{s.name}</strong>
              <small>{modalityLabel(s.modality)} · {s.durationMinutes} min · {s.species.map((x) => x.name).join(', ')}</small>
            </span>
            <span className="price">{money(s.priceCents)}</span>
          </button>
        ))}
      </div>

      <h3 className="section-title">Horários livres</h3>
      {slots.loading && !slots.data ? (
        <Skeleton rows={1} />
      ) : days.length === 0 ? (
        <Empty icon="clock" title="Sem horários livres para este serviço." />
      ) : (
        <>
          <div className="day-strip" role="tablist">
            {days.map(([key, list]) => (
              <button key={key} type="button" role="tab" aria-selected={key === day} className={`day-pill${key === day ? ' active' : ''}`} onClick={() => setDay(key)}>
                <strong>{fmtDay(list[0].startsAt)}</strong>
                <small>{list.length} {list.length === 1 ? 'horário' : 'horários'}</small>
              </button>
            ))}
          </div>
          <div className="times">
            {daySlots.map((s) => (
              <button key={s.id} type="button" className={`time${chosen?.id === s.id ? ' active' : ''}`} onClick={() => choose(s)}>
                {fmtTime(s.startsAt)}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="cta-bar">
        <div className="cta-text">
          {chosen ? (
            <>
              <strong>{fmtDateTime(chosen.startsAt)}</strong>
              <small>{service?.name} · {money(service?.priceCents)}</small>
            </>
          ) : (
            <small className="muted">Escolha um horário</small>
          )}
        </div>
        <button type="button" className="btn" disabled={!chosen || compatible.length === 0} onClick={() => setConfirmOpen(true)}>
          {chosen ? 'Continuar' : 'Agendar'}
        </button>
      </div>

      <Sheet
        open={confirmOpen && !!chosen}
        onClose={() => setConfirmOpen(false)}
        title="Confirmar consulta"
        footer={
          <button type="button" className="btn btn-block" onClick={confirm} disabled={sending || !petId}>
            {sending ? 'Confirmando…' : 'Confirmar agendamento'}
          </button>
        }
      >
        {chosen && (
          <>
            <dl className="summary">
              <dt>Quando</dt><dd>{fmtDateTime(chosen.startsAt)}</dd>
              <dt>Serviço</dt><dd>{service?.name} ({service?.durationMinutes} min)</dd>
              <dt>Com</dt><dd>{p.name}</dd>
              <dt>Onde</dt><dd>{service?.modality === 'REMOTE' ? 'Online (o link chega nas notificações)' : clinic ? `${clinic.name} · ${clinic.address}` : '—'}</dd>
              <dt>Valor</dt><dd>{money(service?.priceCents)}</dd>
            </dl>
            <Field label="Para qual pet?">
              <div className="pet-options">
                {compatible.map((pet) => (
                  <button key={pet.id} type="button" className={`pet-chip selectable${pet.id === petId ? ' active' : ''}`} onClick={() => setPetId(pet.id)} aria-pressed={pet.id === petId}>
                    <span className={`pet-avatar pet-${pet.species.name === 'Gato' ? 'cat' : 'dog'}`}><Icon name="paw" size={18} /></span>
                    <span><strong>{pet.name}</strong><small>{pet.species.name}</small></span>
                  </button>
                ))}
              </div>
            </Field>
            <ErrorNote error={error} />
            <p className="muted small">A consulta é confirmada na hora. Dá para cancelar até o horário de início.</p>
          </>
        )}
      </Sheet>
      {chosen && compatible.length === 0 && pets.data && (
        <p className="note note-warn">Este serviço não atende a espécie dos seus pets.</p>
      )}
    </div>
  );
}
