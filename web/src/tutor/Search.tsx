import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Avatar, Empty, ErrorNote, Field, Sheet, Skeleton } from '../components/ui';
import { Page, api, qs } from '../lib/api';
import { fmtDay, fmtKm, fmtTime, modalityLabel, money, plusDaysKey, todayKey } from '../lib/format';
import { useGeolocation } from '../lib/geo';
import type { ProviderItem, Species } from '../lib/types';
import { useLoad } from '../lib/useLoad';

interface Filters {
  q: string;
  city: string;
  speciesId: string;
  modality: string;
  date: string;
  near: boolean;
}

const EMPTY: Filters = { q: '', city: '', speciesId: '', modality: '', date: '', near: false };

export function Search() {
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [sheet, setSheet] = useState(false);
  const geo = useGeolocation();
  const species = useLoad(() => api.get<{ data: Species[] }>('/species'), []);

  // "Perto de mim" só vale quando a localização chegou.
  useEffect(() => {
    if (geo.state.status === 'denied' || geo.state.status === 'unavailable') setFilters((f) => ({ ...f, near: false }));
  }, [geo.state.status]);

  const near = filters.near && geo.coords;
  const result = useLoad(
    () =>
      api.get<Page<ProviderItem>>(
        `/search/professionals?${qs({
          q: filters.q,
          city: filters.city,
          speciesId: filters.speciesId,
          modality: filters.modality,
          date: filters.date,
          ...(near ? { lat: near.lat, lng: near.lng, sort: 'distance' } : {}),
        })}`,
      ),
    [filters.q, filters.city, filters.speciesId, filters.modality, filters.date, near ? `${near.lat},${near.lng}` : ''],
  );

  const apply = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setDraft((f) => ({ ...f, ...patch }));
  };

  function submit(e: FormEvent) {
    e.preventDefault();
    apply({ q: draft.q });
  }

  function toggleNear() {
    if (filters.near) return apply({ near: false });
    if (!geo.coords) geo.request();
    apply({ near: true });
  }

  const activeCount = [filters.city, filters.modality].filter(Boolean).length;
  const dog = species.data?.data.find((s) => s.name === 'Cachorro');
  const cat = species.data?.data.find((s) => s.name === 'Gato');

  return (
    <div className="page">
      <TopBar title="Buscar" sub="Veterinários e clínicas verificados" />

      <form className="searchbar" onSubmit={submit} role="search">
        <Icon name="search" size={20} className="muted" />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Nome, especialidade ou serviço"
          value={draft.q}
          onChange={(e) => setDraft({ ...draft, q: e.target.value })}
          onBlur={() => draft.q !== filters.q && apply({ q: draft.q })}
          aria-label="Buscar"
        />
        <button type="button" className={`icon-btn${activeCount ? ' has-dot' : ''}`} onClick={() => setSheet(true)} aria-label="Mais filtros">
          <Icon name="filter" />
        </button>
      </form>

      <div className="chips" role="group" aria-label="Filtros rápidos">
        <button type="button" className={`chip${filters.near ? ' active' : ''}`} onClick={toggleNear}>
          <Icon name="locate" size={16} /> {geo.state.status === 'asking' ? 'Localizando…' : 'Perto de mim'}
        </button>
        {dog && <Chip active={filters.speciesId === dog.id} onClick={() => apply({ speciesId: filters.speciesId === dog.id ? '' : dog.id })}>Cães</Chip>}
        {cat && <Chip active={filters.speciesId === cat.id} onClick={() => apply({ speciesId: filters.speciesId === cat.id ? '' : cat.id })}>Gatos</Chip>}
        <Chip active={filters.date === todayKey()} onClick={() => apply({ date: filters.date === todayKey() ? '' : todayKey() })}>Hoje</Chip>
        <Chip active={filters.date === plusDaysKey(1)} onClick={() => apply({ date: filters.date === plusDaysKey(1) ? '' : plusDaysKey(1) })}>Amanhã</Chip>
        <Chip active={filters.modality === 'REMOTE'} onClick={() => apply({ modality: filters.modality === 'REMOTE' ? '' : 'REMOTE' })}>Online</Chip>
      </div>
      {filters.near && 'message' in geo.state && <p className="muted small">{geo.state.message}</p>}

      <ErrorNote error={result.error} onRetry={result.reload} />
      {result.loading && !result.data ? (
        <Skeleton rows={3} />
      ) : result.data && result.data.data.length === 0 ? (
        <Empty icon="search" title="Ninguém com esses filtros." action={<button type="button" className="btn btn-soft" onClick={() => apply(EMPTY)}>Limpar filtros</button>}>
          Tente outra data ou tire algum filtro.
        </Empty>
      ) : (
        <>
          <p className="muted small count">
            {result.data?.meta.total} {result.data?.meta.total === 1 ? 'resultado' : 'resultados'}
            {result.loading && ' · atualizando…'}
          </p>
          <ul className="list">
            {result.data?.data.map((p) => <ProviderCard key={p.id} provider={p} />)}
          </ul>
        </>
      )}

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filtros"
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => { apply(EMPTY); setSheet(false); }}>Limpar</button>
            <button type="button" className="btn grow" onClick={() => { apply({ city: draft.city, modality: draft.modality, date: draft.date }); setSheet(false); }}>Ver resultados</button>
          </div>
        }
      >
        <Field label="Cidade">
          <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Ex.: Recife" autoComplete="address-level2" />
        </Field>
        <Field label="Tipo de atendimento">
          <select value={draft.modality} onChange={(e) => setDraft({ ...draft, modality: e.target.value })}>
            <option value="">Presencial ou online</option>
            <option value="IN_PERSON">Presencial</option>
            <option value="REMOTE">Online</option>
          </select>
        </Field>
        <Field label="Data">
          <input type="date" value={draft.date} min={todayKey()} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
      </Sheet>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip${active ? ' active' : ''}`} aria-pressed={active} onClick={onClick}>{children}</button>
  );
}

function ProviderCard({ provider: p }: { provider: ProviderItem }) {
  const cheapest = p.services.reduce<number | null>((min, s) => (s.priceCents !== null && (min === null || s.priceCents < min) ? s.priceCents : min), null);
  const remote = p.services.some((s) => s.modality === 'REMOTE');
  return (
    <li>
      <Link to={`/profissionais/${p.id}`} className="card provider-card">
        <div className="provider-head">
          <Avatar name={p.name} />
          <div className="grow">
            <h3>{p.name}</h3>
            <span className="muted small">{p.specialty} · CRMV {p.crmv}</span>
          </div>
          {p.distanceKm !== undefined && <span className="distance">{fmtKm(p.distanceKm)}</span>}
        </div>
        <div className="provider-meta">
          <span><Icon name="pin" size={14} /> {[p.neighborhood, p.city].filter(Boolean).join(', ') || 'Atendimento online'}</span>
          {remote && <span><Icon name="video" size={14} /> {modalityLabel('REMOTE')}</span>}
          {cheapest !== null && <span>a partir de {money(cheapest)}</span>}
        </div>
        <div className="provider-foot">
          {p.nextAvailableAt ? (
            <span className="next-slot"><Icon name="clock" size={14} /> {fmtDay(p.nextAvailableAt)}, {fmtTime(p.nextAvailableAt)}</span>
          ) : (
            <span className="muted small">Sem horários livres</span>
          )}
          <span className="link small">Agendar <Icon name="chevron" size={14} /></span>
        </div>
      </Link>
    </li>
  );
}
