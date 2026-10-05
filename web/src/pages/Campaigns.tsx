import { useEffect, useState } from 'react';
import { Page, api } from '../api';
import { Empty, Loading } from '../components/ui';

interface Campaign {
  id: string;
  title: string;
  type: string;
  organization: string;
  audience: string;
  requirements: string;
  location: string;
  startsAt: string;
  endsAt: string;
  sourceUrl: string;
  verifiedAt: string;
}

const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: 'long' });

export function Campaigns() {
  const [page, setPage] = useState<Page<Campaign> | null>(null);

  useEffect(() => {
    api.get<Page<Campaign>>('/campaigns').then(setPage);
  }, []);

  return (
    <>
      <h1>Campanhas</h1>
      <p className="muted">Só aparecem campanhas com fonte oficial, conferidas pela equipe e dentro do período.</p>
      {!page ? (
        <Loading />
      ) : page.data.length === 0 ? (
        <Empty title="Nenhuma campanha ativa agora." />
      ) : (
        <div className="grid">
          {page.data.map((c) => (
            <article key={c.id} className="card campaign">
              <span className="eyebrow">{c.organization}</span>
              <h3>{c.title}</h3>
              <dl>
                <dt>Quem pode</dt><dd>{c.audience}</dd>
                <dt>Onde</dt><dd>{c.location}</dd>
                <dt>O que levar</dt><dd>{c.requirements}</dd>
                <dt>Até</dt><dd>{date(c.endsAt)}</dd>
              </dl>
              <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener">Ver na fonte oficial ↗</a>
              <span className="muted small">Verificada em {date(c.verifiedAt)}</span>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
