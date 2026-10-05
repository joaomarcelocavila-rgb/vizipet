import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, Page, api, dayKey, fmtDay, fmtTime } from '../api';
import { Empty, ErrorNote, Loading, Status } from '../components/ui';

interface Slot {
  id: string;
  serviceId: string;
  startsAt: string;
  status: string;
}

interface Service {
  id: string;
  name: string;
  modality: string;
  durationMinutes: number;
  active: boolean;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
const plusDays = (n: number) => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Recife' });

export function Slots() {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ serviceId: '', clinicId: '', fromDate: plusDays(1), toDate: plusDays(14), startTime: '08:00', endTime: '12:00', weekdays: [1, 3, 5] });
  const [error, setError] = useState<ApiError | null>(null);
  const [flash, setFlash] = useState('');

  const load = () =>
    api.get<Page<Slot>>(`/availability/mine?limit=50&from=${today()}T00:00:00-03:00`).then((r) => setSlots(r.data)).catch(setError);

  useEffect(() => {
    load();
    api.get<{ data: Service[] }>('/services/mine').then((r) => {
      setServices(r.data);
      setForm((f) => ({ ...f, serviceId: r.data.find((s) => s.active)?.id ?? '' }));
    });
    api.get<{ data: { id: string; name: string }[] }>('/clinics/mine').then((r) => {
      setClinics(r.data);
      setForm((f) => ({ ...f, clinicId: r.data[0]?.id ?? '' }));
    });
  }, []);

  const service = services.find((s) => s.id === form.serviceId);
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) map.set(dayKey(s.startsAt), [...(map.get(dayKey(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [slots]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFlash('');
    try {
      const { clinicId, ...rest } = form;
      const res = await api.post<{ data: { created: number } }>('/availability/batch', {
        ...rest,
        ...(service?.modality === 'IN_PERSON' && clinicId ? { clinicId } : {}),
      });
      setFlash(`${res.data.created} horários criados.`);
      load();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  async function toggle(slot: Slot) {
    try {
      await api.patch(`/availability/${slot.id}/${slot.status === 'BLOCKED' ? 'unblock' : 'block'}`);
      load();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  const set = (key: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() }));

  return (
    <>
      <h1>Horários</h1>
      <form className="card batch" onSubmit={generate}>
        <h2>Gerar horários</h2>
        <div className="batch-row">
          <label>Serviço
            <select value={form.serviceId} onChange={set('serviceId')}>
              {services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>)}
            </select>
          </label>
          {service?.modality === 'IN_PERSON' && (
            <label>Clínica
              <select value={form.clinicId} onChange={set('clinicId')}>
                {clinics.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label>De<input type="date" value={form.fromDate} onChange={set('fromDate')} /></label>
          <label>Até<input type="date" value={form.toDate} onChange={set('toDate')} /></label>
          <label>Das<input type="time" value={form.startTime} onChange={set('startTime')} /></label>
          <label>Às<input type="time" value={form.endTime} onChange={set('endTime')} /></label>
        </div>
        <div className="weekdays">
          {WEEKDAYS.map((label, d) => (
            <button type="button" key={d} className={`day-toggle ${form.weekdays.includes(d) ? 'active' : ''}`} onClick={() => toggleDay(d)}>{label}</button>
          ))}
          <button className="btn">Gerar</button>
        </div>
        {flash && <p className="flash">{flash}</p>}
        <ErrorNote error={error} />
      </form>

      <h2>Próximos horários</h2>
      {!slots ? (
        <Loading />
      ) : byDay.length === 0 ? (
        <Empty title="Nenhum horário futuro." />
      ) : (
        byDay.map(([day, list]) => (
          <div key={day} className="day">
            <span className="day-label">{fmtDay(list[0].startsAt)}</span>
            <div className="times">
              {list.map((s) => (
                <button key={s.id} className={`time slot-${s.status.toLowerCase()}`} onClick={() => s.status !== 'BOOKED' && toggle(s)} title={s.status === 'BOOKED' ? 'Reservado' : 'Clique para bloquear/desbloquear'}>
                  {fmtTime(s.startsAt)} <Status value={s.status} />
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
