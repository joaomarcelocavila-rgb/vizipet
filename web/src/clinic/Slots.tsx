import { FormEvent, useEffect, useMemo, useState } from 'react';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Field, Sheet, Skeleton, Status, useToast } from '../components/ui';
import { ApiError, Page, api } from '../lib/api';
import { dayKey, fmtDay, fmtTime, plusDaysKey, todayKey } from '../lib/format';
import type { OwnedClinic, OwnedService, Slot } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function Slots() {
  const toast = useToast();
  const slots = useLoad(() => api.get<Page<Slot>>(`/availability/mine?limit=50&from=${todayKey()}T00:00:00-03:00`), []);
  const services = useLoad(() => api.get<{ data: OwnedService[] }>('/services/mine'), []);
  const clinics = useLoad(() => api.get<{ data: OwnedClinic[] }>('/clinics/mine'), []);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ serviceId: '', clinicId: '', fromDate: plusDaysKey(1), toDate: plusDaysKey(14), startTime: '08:00', endTime: '12:00', weekdays: [1, 2, 3, 4, 5] });
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  const active = (services.data?.data ?? []).filter((s) => s.active);
  const service = active.find((s) => s.id === form.serviceId);
  useEffect(() => {
    if (!form.serviceId && active[0]) setForm((f) => ({ ...f, serviceId: active[0].id }));
    if (!form.clinicId && clinics.data?.data[0]) setForm((f) => ({ ...f, clinicId: clinics.data!.data[0].id }));
  }, [active, clinics.data, form.serviceId, form.clinicId]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots.data?.data ?? []) map.set(dayKey(s.startsAt), [...(map.get(dayKey(s.startsAt)) ?? []), s]);
    return [...map.entries()];
  }, [slots.data]);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { clinicId, ...rest } = form;
      const res = await api.post<{ data: { created: number } }>('/availability/batch', {
        ...rest,
        ...(service?.modality === 'IN_PERSON' && clinicId ? { clinicId } : {}),
      });
      toast(`${res.data.created} horários abertos.`);
      setOpen(false);
      slots.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(slot: Slot) {
    if (slot.status === 'BOOKED') return;
    try {
      await api.patch(`/availability/${slot.id}/${slot.status === 'BLOCKED' ? 'unblock' : 'block'}`);
      slots.reload();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  const set = (key: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const toggleDay = (d: number) =>
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((x) => x !== d) : [...f.weekdays, d].sort() }));

  return (
    <div className="page">
      <TopBar title="Horários" sub="Toque num horário livre para bloquear" action={<button type="button" className="btn btn-sm" onClick={() => { setError(null); setOpen(true); }}>Abrir horários</button>} />

      <div className="legend">
        <Status value="AVAILABLE" /> <Status value="BOOKED" /> <Status value="BLOCKED" />
      </div>
      {!open && <ErrorNote error={error} />}

      {slots.loading && !slots.data ? (
        <Skeleton rows={3} />
      ) : byDay.length === 0 ? (
        <Empty icon="clock" title="Nenhum horário aberto." action={<button type="button" className="btn" onClick={() => setOpen(true)}>Abrir horários</button>}>
          Gere vários de uma vez: escolha os dias da semana e o intervalo.
        </Empty>
      ) : (
        byDay.map(([key, list]) => (
          <section key={key} className="day-group">
            <h3 className="day-label">{fmtDay(list[0].startsAt)} <span className="muted small">· {list.filter((s) => s.status === 'AVAILABLE').length} livres</span></h3>
            <div className="times">
              {list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`time slot-${s.status?.toLowerCase()}`}
                  onClick={() => toggle(s)}
                  disabled={s.status === 'BOOKED'}
                  aria-label={`${fmtTime(s.startsAt)}, ${s.status === 'BOOKED' ? 'reservado' : s.status === 'BLOCKED' ? 'bloqueado, toque para liberar' : 'livre, toque para bloquear'}`}
                >
                  {fmtTime(s.startsAt)}
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Abrir horários"
        footer={<button type="submit" form="batch-form" className="btn btn-block" disabled={busy || !form.serviceId || form.weekdays.length === 0}>{busy ? 'Gerando…' : 'Gerar horários'}</button>}
      >
        {active.length === 0 ? (
          <Empty icon="stethoscope" title="Cadastre um serviço primeiro.">Os horários usam a duração do serviço.</Empty>
        ) : (
          <form id="batch-form" onSubmit={generate} className="form">
            <Field label="Serviço">
              <select value={form.serviceId} onChange={set('serviceId')}>
                {active.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMinutes} min)</option>)}
              </select>
            </Field>
            {service?.modality === 'IN_PERSON' && (clinics.data?.data.length ?? 0) > 0 && (
              <Field label="Clínica">
                <select value={form.clinicId} onChange={set('clinicId')}>
                  {clinics.data!.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            )}
            <div className="grid-2">
              <Field label="De"><input type="date" value={form.fromDate} min={todayKey()} onChange={set('fromDate')} /></Field>
              <Field label="Até"><input type="date" value={form.toDate} min={form.fromDate} onChange={set('toDate')} /></Field>
              <Field label="Das"><input type="time" value={form.startTime} onChange={set('startTime')} /></Field>
              <Field label="Às"><input type="time" value={form.endTime} onChange={set('endTime')} /></Field>
            </div>
            <div className="field">
              <span className="field-label">Dias da semana</span>
              <div className="weekdays">
                {WEEKDAYS.map((label, d) => (
                  <button type="button" key={d} className={`weekday${form.weekdays.includes(d) ? ' active' : ''}`} aria-pressed={form.weekdays.includes(d)} aria-label={WEEKDAY_NAMES[d]} onClick={() => toggleDay(d)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ErrorNote error={error} />
          </form>
        )}
      </Sheet>
    </div>
  );
}
