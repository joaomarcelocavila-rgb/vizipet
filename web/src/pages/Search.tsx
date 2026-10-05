import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, Page, api, fmtDateTime, money } from '../api';
import { Empty, ErrorNote, Loading, modalityLabel } from '../components/ui';

export interface ServiceItem {
  id: string;
  name: string;
  modality: string;
  durationMinutes: number;
  priceCents: number | null;
  species: { id: string; name: string }[];
}

export interface ProviderItem {
  id: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  crmv: string;
  city: string | null;
  neighborhood: string | null;
  services: ServiceItem[];
  clinics: { id: string; name: string; address: string }[];
  nextAvailableAt: string | null;
  distanceKm?: number;
}

interface Campaign {
  id: string;
  title: string;
  organization: string;
  endsAt: string;
}

export function Search() {
  const [species, setSpecies] = useState<{ id: string; name: string }[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState({ q: '', city: '', speciesId: '', modality: '', date: '' });
  const [result, setResult] = useState<Page<ProviderItem> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ data: { id: string; name: string }[] }>('/species').then((r) => setSpecies(r.data));
    api.get<Page<Campaign>>('/campaigns?limit=3').then((r) => setCampaigns(r.data));
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
    try {
      setResult(await api.get<Page<ProviderItem>>(`/search/professionals?${params}`));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setLoading(false);
    }
  }

  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <section className="hero">
        <h1>Encontre quem cuida do seu pet</h1>
        <form className="search" onSubmit={run}>
          <input placeholder="Nome, especialidade ou serviço" value={filters.q} onChange={set('q')} />
          <input placeholder="Cidade" value={filters.city} onChange={set('city')} />
          <select value={filters.speciesId} onChange={set('speciesId')}>
            <option value="">Qualquer espécie</option>
            {species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filters.modality} onChange={set('modality')}>
            <option value="">Presencial ou online</option>
            <option value="IN_PERSON">Presencial</option>
            <option value="REMOTE">Online</option>
          </select>
          <input type="date" value={filters.date} onChange={set('date')} aria-label="Data" />
          <button className="btn">Buscar</button>
        </form>
      </section>

      {campaigns.length > 0 && (
        <section className="campaign-strip">
          <span className="eyebrow">Campanhas oficiais</span>
          {campaigns.map((c) => (
            <Link key={c.id} to="/campanhas" className="campaign-chip">
              <strong>{c.title}</strong>
              <span>{c.organization}</span>
            </Link>
          ))}
        </section>
      )}

      <ErrorNote error={error} />
      {loading && !result && <Loading />}
      {result && (
        <>
          <p className="muted count">
            {result.meta.total} {result.meta.total === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
          </p>
          {result.data.length === 0 ? (
            <Empty title="Ninguém por aqui com esses filtros.">Tente outra data ou tire a cidade.</Empty>
          ) : (
            <div className="grid">
              {result.data.map((p) => <ProviderCard key={p.id} provider={p} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}

function ProviderCard({ provider: p }: { provider: ProviderItem }) {
  return (
    <Link to={`/profissionais/${p.id}`} className="card provider">
      <div className="provider-head">
        <span className="avatar avatar-professional">{p.name.replace(/^(Dra?\.)\s*/, '').charAt(0)}</span>
        <div>
          <h3>{p.name}</h3>
          <p className="muted">{p.specialty} · CRMV {p.crmv}</p>
        </div>
      </div>
      <p className="muted small">{[p.neighborhood, p.city].filter(Boolean).join(', ')}</p>
      <ul className="services">
        {p.services.map((s) => (
          <li key={s.id}>
            <span>{s.name}</span>
            <span className="muted">{modalityLabel(s.modality)} · {money(s.priceCents)}</span>
          </li>
        ))}
      </ul>
      <div className="next">
        {p.nextAvailableAt ? <>Próximo horário <strong>{fmtDateTime(p.nextAvailableAt)}</strong></> : <span className="muted">Sem horários livres</span>}
      </div>
    </Link>
  );
}
