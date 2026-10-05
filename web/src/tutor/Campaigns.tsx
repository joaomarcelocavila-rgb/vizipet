import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Skeleton } from '../components/ui';
import { Page, api } from '../lib/api';
import { fmtDate } from '../lib/format';
import type { Campaign } from '../lib/types';
import { useLoad } from '../lib/useLoad';

export function Campaigns() {
  const { data, error, reload } = useLoad(() => api.get<Page<Campaign>>('/campaigns'), []);

  return (
    <div className="page">
      <TopBar title="Campanhas" back sub="Vacinação, castração e outras ações públicas" />
      <p className="muted small">Só aparecem campanhas com fonte oficial, conferidas pela equipe e dentro do prazo.</p>
      <ErrorNote error={error} onRetry={reload} />
      {!data ? (
        error ? null : <Skeleton rows={2} />
      ) : data.data.length === 0 ? (
        <Empty icon="megaphone" title="Nenhuma campanha ativa agora." />
      ) : (
        <ul className="list">
          {data.data.map((c) => (
            <li key={c.id} className="card campaign">
              <span className="eyebrow">{c.organization}</span>
              <h3>{c.title}</h3>
              <dl className="summary">
                <dt>Quem pode</dt><dd>{c.audience}</dd>
                <dt>Onde</dt><dd>{c.location}</dd>
                <dt>O que levar</dt><dd>{c.requirements}</dd>
                <dt>Até</dt><dd>{fmtDate(c.endsAt)}</dd>
              </dl>
              <div className="row between">
                <a href={c.sourceUrl} target="_blank" rel="noreferrer noopener" className="btn btn-soft btn-sm">
                  Fonte oficial <Icon name="external" size={14} />
                </a>
                {c.verifiedAt && <span className="muted small">Conferida em {fmtDate(c.verifiedAt)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
