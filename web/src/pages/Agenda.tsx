import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, Page, api, fmtDateTime, money } from '../api';
import { Empty, ErrorNote, Loading, Status, modalityLabel } from '../components/ui';

interface Appointment {
  id: string;
  status: string;
  startsAt: string;
  cancelReason: string | null;
  snapshot: {
    serviceName: string;
    modality: string;
    priceCents: number | null;
    durationMinutes: number;
    professionalName: string;
    clinicName: string | null;
    clinicAddress: string | null;
    petName: string;
    tutorName: string;
  };
}

const TABS = [
  ['upcoming', 'Próximas'],
  ['past', 'Anteriores'],
  ['cancelled', 'Canceladas'],
] as const;

export function Agenda({ role }: { role: 'TUTOR' | 'PROFESSIONAL' | 'ADMIN' }) {
  const [params, setParams] = useSearchParams();
  const scope = params.get('scope') ?? 'upcoming';
  const [page, setPage] = useState<Page<Appointment> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [flash, setFlash] = useState(params.get('ok') ? 'Agendamento confirmado. Você vai receber a confirmação nas notificações.' : '');

  const load = useCallback(() => {
    setPage(null);
    api.get<Page<Appointment>>(`/appointments?scope=${scope}`).then(setPage).catch(setError);
  }, [scope]);

  useEffect(load, [load]);

  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function cancel(a: Appointment) {
    const trimmed = reason.trim();
    if (role === 'PROFESSIONAL' && !trimmed) return;
    try {
      await api.post(`/appointments/${a.id}/cancel`, trimmed ? { reason: trimmed } : {});
      setCancelling(null);
      setReason('');
      setFlash('Consulta cancelada e horário liberado.');
      load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  async function complete(a: Appointment) {
    try {
      await api.post(`/appointments/${a.id}/complete`);
      load();
    } catch (e) {
      setError(e as ApiError);
    }
  }

  return (
    <>
      <h1>{role === 'PROFESSIONAL' ? 'Minha agenda' : 'Consultas'}</h1>
      {flash && <p className="flash">{flash}</p>}
      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`tab ${scope === key ? 'active' : ''}`} onClick={() => { setFlash(''); setParams({ scope: key }); }}>
            {label}
          </button>
        ))}
      </div>
      <ErrorNote error={error} />
      {!page ? (
        <Loading />
      ) : page.data.length === 0 ? (
        <Empty title="Nada por aqui.">{scope === 'upcoming' && role === 'TUTOR' ? 'Busque um profissional para marcar uma consulta.' : null}</Empty>
      ) : (
        <ul className="appointments">
          {page.data.map((a) => (
            <li key={a.id} className="card appointment">
              <div className="when">
                <strong>{fmtDateTime(a.startsAt)}</strong>
                <span className="muted small">{a.snapshot.durationMinutes} min</span>
              </div>
              <div className="what">
                <strong>{a.snapshot.serviceName}</strong>
                <span>
                  {role === 'PROFESSIONAL' ? `${a.snapshot.petName} · tutor(a) ${a.snapshot.tutorName}` : `${a.snapshot.petName} com ${a.snapshot.professionalName}`}
                </span>
                <span className="muted small">
                  {a.snapshot.modality === 'REMOTE' ? 'Online' : `${a.snapshot.clinicName} — ${a.snapshot.clinicAddress}`} · {money(a.snapshot.priceCents)}
                </span>
                {a.cancelReason && <span className="muted small">Motivo: {a.cancelReason}</span>}
              </div>
              <div className="actions">
                <Status value={a.status} />
                {a.status === 'CONFIRMED' && new Date(a.startsAt) > new Date() && cancelling !== a.id && (
                  <button className="btn btn-ghost" onClick={() => { setCancelling(a.id); setReason(''); }}>Cancelar</button>
                )}
                {a.status === 'CONFIRMED' && role === 'PROFESSIONAL' && new Date(a.startsAt) <= new Date() && (
                  <button className="btn btn-ghost" onClick={() => complete(a)}>Concluir</button>
                )}
              </div>
              {cancelling === a.id && (
                <div className="confirm">
                  {role === 'PROFESSIONAL' ? (
                    <label htmlFor={`reason-${a.id}`}>
                      Motivo (o tutor vai receber)
                      <input id={`reason-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: emergência na clínica" autoFocus />
                    </label>
                  ) : (
                    <span>Cancelar {a.snapshot.serviceName} de {a.snapshot.petName}? O horário volta a ficar livre.</span>
                  )}
                  <div className="confirm-actions">
                    <button className="btn btn-ghost" onClick={() => setCancelling(null)}>Voltar</button>
                    <button className="btn btn-danger" onClick={() => cancel(a)} disabled={role === 'PROFESSIONAL' && !reason.trim()}>
                      Confirmar cancelamento
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {role !== 'PROFESSIONAL' && page && <p className="muted small">{modalityLabel('IN_PERSON')} ou online, todos os horários estão no fuso de Recife.</p>}
    </>
  );
}
