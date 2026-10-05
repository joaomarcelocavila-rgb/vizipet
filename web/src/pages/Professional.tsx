import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, dayKey, fmtDateTime, fmtDay, fmtTime, money, session } from '../api';
import { Empty, ErrorNote, Loading, modalityLabel } from '../components/ui';
import type { ProviderItem } from './Search';

interface Slot {
  id: string;
  serviceId: string;
  clinicId: string | null;
  startsAt: string;
  endsAt: string;
}

interface Pet {
  id: string;
  name: string;
  species: { id: string; name: string };
}

export function Professional() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [provider, setProvider] = useState<ProviderItem | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [chosen, setChosen] = useState<Slot | null>(null);
  const [petId, setPetId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [sending, setSending] = useState(false);
  const isTutor = session.user?.role === 'TUTOR';

  useEffect(() => {
    api.get<{ data: ProviderItem }>(`/search/professionals/${id}`).then((r) => {
      setProvider(r.data);
      setServiceId(r.data.services[0]?.id ?? '');
    }).catch(setError);
    if (isTutor) api.get<{ data: Pet[] }>('/dev/pets').then((r) => setPets(r.data));
  }, [id, isTutor]);

  useEffect(() => {
    if (!serviceId) return;
    api.get<{ data: Slot[] }>(`/search/professionals/${id}/slots?serviceId=${serviceId}`).then((r) => setSlots(r.data));
  }, [id, serviceId]);

  const service = provider?.services.find((s) => s.id === serviceId);
  const compatiblePets = pets.filter((p) => service?.species.some((s) => s.id === p.species.id));
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) map.set(dayKey(s.startsAt), [...(map.get(dayKey(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  function choose(slot: Slot) {
    setChosen(slot);
    setError(null);
    setPetId(compatiblePets[0]?.id ?? '');
    // Uma chave por tentativa de agendamento: cliques repetidos reaproveitam a mesma.
    setIdempotencyKey(crypto.randomUUID());
  }

  async function confirm() {
    if (!chosen || !provider) return;
    setSending(true);
    setError(null);
    try {
      await api.post(
        '/appointments',
        { petId, serviceId, professionalId: provider.id, slotId: chosen.id, ...(chosen.clinicId ? { clinicId: chosen.clinicId } : {}) },
        { 'Idempotency-Key': idempotencyKey },
      );
      navigate('/agenda?ok=1');
    } catch (e) {
      setError(e as ApiError);
      setSending(false);
    }
  }

  if (!provider) return error ? <ErrorNote error={error} /> : <Loading />;
  const clinic = provider.clinics.find((c) => c.id === chosen?.clinicId) ?? provider.clinics[0];

  return (
    <div className="profile">
      <Link to="/" className="back">← Voltar para a busca</Link>
      <section className="profile-head">
        <span className="avatar avatar-professional avatar-lg">{provider.name.replace(/^(Dra?\.)\s*/, '').charAt(0)}</span>
        <div>
          <h1>{provider.name}</h1>
          <p className="muted">{provider.specialty} · CRMV {provider.crmv} · {[provider.neighborhood, provider.city].filter(Boolean).join(', ')}</p>
          {provider.bio && <p>{provider.bio}</p>}
        </div>
      </section>

      <div className="profile-body">
        <section>
          <h2>Serviços</h2>
          <div className="service-tabs">
            {provider.services.map((s) => (
              <button key={s.id} className={`service-tab ${s.id === serviceId ? 'active' : ''}`} onClick={() => { setServiceId(s.id); setChosen(null); }}>
                <strong>{s.name}</strong>
                <span>{modalityLabel(s.modality)} · {s.durationMinutes} min · {money(s.priceCents)}</span>
                <small>Atende: {s.species.map((x) => x.name).join(', ')}</small>
              </button>
            ))}
          </div>

          <h2>Horários livres</h2>
          {byDay.length === 0 ? (
            <Empty title="Nenhum horário livre para este serviço." />
          ) : (
            byDay.map(([day, list]) => (
              <div key={day} className="day">
                <span className="day-label">{fmtDay(list[0].startsAt)}</span>
                <div className="times">
                  {list.map((s) => (
                    <button key={s.id} className={`time ${chosen?.id === s.id ? 'active' : ''}`} onClick={() => choose(s)} disabled={!isTutor}>
                      {fmtTime(s.startsAt)}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <aside className="booking card">
          {provider.clinics.length > 0 && (
            <div className="clinic">
              <span className="eyebrow">Onde</span>
              <strong>{clinic.name}</strong>
              <span className="muted small">{clinic.address}</span>
            </div>
          )}
          {!isTutor ? (
            <p className="muted">Entre como tutor para agendar.</p>
          ) : !chosen ? (
            <p className="muted">Escolha um horário ao lado.</p>
          ) : (
            <>
              <span className="eyebrow">Seu agendamento</span>
              <strong className="booking-when">{fmtDateTime(chosen.startsAt)}</strong>
              <span className="muted small">{service?.name} · {money(service?.priceCents ?? null)}</span>
              <label>
                Para qual pet?
                <select value={petId} onChange={(e) => setPetId(e.target.value)}>
                  {pets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.species.name})</option>
                  ))}
                </select>
              </label>
              {compatiblePets.length === 0 && <p className="muted small">Este serviço não atende a espécie dos seus pets.</p>}
              <ErrorNote error={error} />
              <button className="btn btn-block" onClick={confirm} disabled={sending || !petId}>
                {sending ? 'Confirmando…' : 'Confirmar agendamento'}
              </button>
              <small className="muted">A consulta é confirmada na hora. Dá para cancelar até o horário de início.</small>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
