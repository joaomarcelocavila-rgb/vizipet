import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Field, Segmented, Sheet, Skeleton, Status, useToast } from '../components/ui';
import { ApiError, Page, api } from '../lib/api';
import { dayKey, fmtDay, fmtTime, money } from '../lib/format';
import { mapsRoute } from '../lib/geo';
import type { Appointment } from '../lib/types';
import { useLoad } from '../lib/useLoad';

const SCOPES = [
  ['upcoming', 'Próximas'],
  ['past', 'Anteriores'],
  ['cancelled', 'Canceladas'],
] as const;
type Scope = (typeof SCOPES)[number][0];

/** Lista de consultas do tutor ou da clínica, com cancelar e concluir. */
export function AppointmentList({ role }: { role: 'TUTOR' | 'PROFESSIONAL' }) {
  const toast = useToast();
  const [scope, setScope] = useState<Scope>('upcoming');
  const { data, error, loading, reload } = useLoad(() => api.get<Page<Appointment>>(`/appointments?scope=${scope}&limit=50`), [scope]);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!cancelling) return;
    const trimmed = reason.trim();
    setBusy(true);
    setActionError(null);
    try {
      await api.post(`/appointments/${cancelling.id}/cancel`, trimmed ? { reason: trimmed } : {});
      setCancelling(null);
      setReason('');
      toast('Consulta cancelada e horário liberado.');
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function complete(a: Appointment) {
    try {
      await api.post(`/appointments/${a.id}/complete`);
      toast('Consulta concluída.');
      reload();
    } catch (e) {
      setActionError(e as ApiError);
    }
  }

  // Agrupa por dia para a leitura ficar rápida no celular.
  const groups: [string, Appointment[]][] = [];
  for (const a of data?.data ?? []) {
    const key = dayKey(a.startsAt);
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(a);
    else groups.push([key, [a]]);
  }

  return (
    <>
      <Segmented value={scope} options={SCOPES} onChange={setScope} />
      <ErrorNote error={error ?? (cancelling ? null : actionError)} onRetry={error ? reload : undefined} />
      {loading && !data ? (
        <Skeleton rows={3} />
      ) : groups.length === 0 ? (
        <Empty
          icon="calendar"
          title={scope === 'upcoming' ? 'Nenhuma consulta marcada.' : 'Nada por aqui.'}
          action={scope === 'upcoming' && role === 'TUTOR' ? <Link to="/buscar" className="btn">Marcar consulta</Link> : undefined}
        >
          {scope === 'upcoming' && role === 'PROFESSIONAL' ? 'Abra horários para os tutores poderem agendar.' : null}
        </Empty>
      ) : (
        groups.map(([key, list]) => (
          <section key={key} className="day-group">
            <h3 className="day-label">{fmtDay(list[0].startsAt)}</h3>
            <ul className="list">
              {list.map((a) => {
                const future = new Date(a.startsAt) > new Date();
                return (
                  <li key={a.id} className="card appt">
                    <div className="appt-time">
                      <strong>{fmtTime(a.startsAt)}</strong>
                      <small>{a.snapshot.durationMinutes} min</small>
                    </div>
                    <div className="appt-body">
                      <div className="appt-title">
                        <strong>{a.snapshot.serviceName}</strong>
                        <Status value={a.status} />
                      </div>
                      <span>
                        {role === 'PROFESSIONAL'
                          ? `${a.snapshot.petName} · tutor(a) ${a.snapshot.tutorName}`
                          : `${a.snapshot.petName} com ${a.snapshot.professionalName}`}
                      </span>
                      <span className="muted small">
                        {a.snapshot.modality === 'REMOTE' ? 'Online' : a.snapshot.clinicName} · {money(a.snapshot.priceCents)}
                      </span>
                      {a.cancelReason && <span className="muted small">Motivo: {a.cancelReason}</span>}
                      {a.status === 'CONFIRMED' && (
                        <div className="appt-actions">
                          {role === 'TUTOR' && a.snapshot.modality !== 'REMOTE' && a.snapshot.clinicAddress && future && (
                            <a className="btn btn-soft btn-sm" href={mapsRoute({ name: a.snapshot.clinicName ?? '', address: a.snapshot.clinicAddress })} target="_blank" rel="noreferrer noopener">
                              <Icon name="route" size={16} /> Como chegar
                            </a>
                          )}
                          {future && (
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCancelling(a); setReason(''); setActionError(null); }}>Cancelar</button>
                          )}
                          {role === 'PROFESSIONAL' && !future && (
                            <button type="button" className="btn btn-sm" onClick={() => complete(a)}><Icon name="check" size={16} /> Concluir</button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Sheet
        open={!!cancelling}
        onClose={() => setCancelling(null)}
        title="Cancelar consulta"
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setCancelling(null)}>Voltar</button>
            <button type="button" className="btn btn-danger grow" onClick={cancel} disabled={busy || (role === 'PROFESSIONAL' && !reason.trim())}>
              {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </button>
          </div>
        }
      >
        {cancelling && (
          <>
            <p>
              {cancelling.snapshot.serviceName} de <strong>{cancelling.snapshot.petName}</strong>, {fmtDay(cancelling.startsAt).toLowerCase()} às {fmtTime(cancelling.startsAt)}. O horário volta a ficar livre.
            </p>
            <Field label={role === 'PROFESSIONAL' ? 'Motivo (o tutor vai receber)' : 'Motivo (opcional)'}>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={role === 'PROFESSIONAL' ? 'Ex.: emergência na clínica' : 'Ex.: imprevisto'} />
            </Field>
            <ErrorNote error={actionError} />
          </>
        )}
      </Sheet>
    </>
  );
}

export function Appointments({ role }: { role: 'TUTOR' }) {
  return (
    <div className="page">
      <TopBar title="Consultas" sub="Horários no fuso de Recife" />
      <AppointmentList role={role} />
    </div>
  );
}
