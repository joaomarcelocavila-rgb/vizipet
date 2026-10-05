import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Skeleton } from '../components/ui';
import { Page, api, qs, session, store } from '../lib/api';
import { fmtDateTime, fmtKm, fmtPhone } from '../lib/format';
import { mapsRoute, telHref, useGeolocation, wazeRoute } from '../lib/geo';
import type { PublicClinic } from '../lib/types';
import { useLoad } from '../lib/useLoad';

// Última lista que deu certo: numa emergência sem sinal, ainda dá para ligar.
const SAVED_KEY = 'vizipet.emergency.last';
function readSaved(): { at: string; data: PublicClinic[] } | null {
  try {
    const raw = store.get(SAVED_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const FIRST_AID = [
  {
    title: 'Atropelamento ou queda',
    steps: [
      'Afaste o animal do perigo com cuidado, mexendo o mínimo possível.',
      'Use uma tábua, toalha ou cobertor como maca, mantendo a coluna reta.',
      'Mesmo os mais dóceis podem morder de dor: proteja as mãos e o rosto.',
    ],
  },
  {
    title: 'Envenenamento ou intoxicação',
    steps: [
      'Não provoque vômito nem dê leite, óleo ou remédio caseiro.',
      'Leve a embalagem ou um pedaço do que ele comeu ou tocou.',
      'Anote a hora em que aconteceu e vá direto ao plantão.',
    ],
  },
  {
    title: 'Sangramento',
    steps: [
      'Pressione o ferimento com pano limpo ou gaze, sem soltar.',
      'Se o pano encharcar, coloque outro por cima e continue pressionando.',
      'Não use garrote, a não ser que o veterinário oriente por telefone.',
    ],
  },
  {
    title: 'Convulsão',
    steps: [
      'Afaste móveis e objetos e deixe o ambiente escuro e silencioso.',
      'Não coloque a mão nem objetos na boca do animal.',
      'Marque quanto tempo dura. Mais de 5 minutos é emergência grave.',
    ],
  },
  {
    title: 'Calor excessivo ou insolação',
    steps: [
      'Leve para a sombra e ofereça água fresca, sem forçar.',
      'Molhe patas, barriga e pescoço com água em temperatura ambiente. Gelo não.',
      'Respiração muito rápida, língua roxa ou desmaio: vá ao plantão já.',
    ],
  },
  {
    title: 'Engasgo ou falta de ar',
    steps: [
      'Abra a boca com cuidado e veja se há objeto visível e fácil de tirar.',
      'Não puxe nada que esteja preso fundo na garganta.',
      'Mantenha o animal calmo e siga para o atendimento.',
    ],
  },
];

export function Emergency() {
  const geo = useGeolocation();
  const loggedIn = !!session.user;
  const [open, setOpen] = useState<number | null>(null);

  // Numa emergência não faz sentido esperar um toque: já pede a localização.
  useEffect(() => {
    geo.request();
  }, [geo.request]);

  const waitingGeo = geo.state.status === 'asking' || geo.state.status === 'idle';
  const { data, error, loading, reload } = useLoad(
    () => (waitingGeo ? Promise.resolve(null) : api.get<Page<PublicClinic>>(`/search/clinics?${qs({ emergency: true, lat: geo.coords?.lat, lng: geo.coords?.lng, limit: 20 })}`)),
    [waitingGeo, geo.coords?.lat, geo.coords?.lng],
  );

  useEffect(() => {
    if (data) store.set(SAVED_KEY, JSON.stringify({ at: new Date().toISOString(), data: data.data }));
  }, [data]);
  const saved = !data && error ? readSaved() : null;
  const clinics = data?.data ?? saved?.data ?? [];
  const nearest = clinics[0];

  return (
    <div className="page emergency">
      <TopBar title="Emergência" back={loggedIn ? undefined : '/entrar'} sub="Plantões veterinários 24 horas" />

      <section className="emergency-hero">
        <div>
          <strong>Mantenha a calma.</strong>
          <p>Ligue antes de sair: o plantão já se prepara para receber seu pet.</p>
        </div>
        <div className={`geo-status geo-${geo.state.status}`}>
          <Icon name={geo.coords ? 'locate' : 'pin'} size={18} />
          {geo.state.status === 'asking' || geo.state.status === 'idle'
            ? 'Procurando sua localização…'
            : geo.coords
              ? 'Ordenado pela distância até você'
              : (
                <>
                  {'message' in geo.state ? geo.state.message : ''}
                  <button type="button" className="link" onClick={geo.request}>Tentar de novo</button>
                </>
              )}
        </div>
      </section>

      {nearest && nearest.phone && (
        <a className="call-nearest" href={telHref(nearest.phone)}>
          <Icon name="phone" size={24} />
          <span>
            <strong>Ligar para o mais próximo</strong>
            <small>{nearest.name}{nearest.distanceKm !== undefined ? ` · ${fmtKm(nearest.distanceKm)}` : ''}</small>
          </span>
        </a>
      )}

      {saved ? (
        <div className="note note-warn offline-note">
          <Icon name="wifiOff" size={18} />
          <span>
            Sem internet. Mostrando a lista salva em {fmtDateTime(saved.at).toLowerCase()}; as ligações funcionam normalmente.{' '}
            <button type="button" className="link" onClick={reload}>Tentar de novo</button>
          </span>
        </div>
      ) : (
        <ErrorNote error={error} onRetry={reload} />
      )}
      {(loading || waitingGeo) && !data && !saved ? (
        <Skeleton rows={3} />
      ) : clinics.length === 0 ? (
        <Empty icon="building" title="Nenhum plantão 24h cadastrado ainda.">Ligue para a clínica mais próxima ou procure o serviço público da sua cidade.</Empty>
      ) : (
        <ul className="list">
          {clinics.map((c, i) => (
            <li key={c.id} className={`card er-card${i === 0 && c.distanceKm !== undefined ? ' er-nearest' : ''}`}>
              <div className="er-head">
                <div>
                  <h3>{c.name}</h3>
                  <p className="muted small">{c.address}</p>
                </div>
                {c.distanceKm !== undefined && <span className="distance">{fmtKm(c.distanceKm)}</span>}
              </div>
              <div className="er-tags">
                <span className="pill pill-danger"><Icon name="clock" size={14} /> 24 horas</span>
                {i === 0 && c.distanceKm !== undefined && <span className="pill pill-ok">Mais perto</span>}
              </div>
              {c.description && <p className="small">{c.description}</p>}
              <div className="er-actions">
                {c.phone ? (
                  <a className="btn btn-danger" href={telHref(c.phone)}><Icon name="phone" size={18} /> {fmtPhone(c.phone)}</a>
                ) : (
                  <span className="muted small">Sem telefone cadastrado</span>
                )}
                <a className="btn btn-soft" href={mapsRoute(c)} target="_blank" rel="noreferrer noopener"><Icon name="route" size={18} /> Rota</a>
                <a className="btn btn-soft" href={wazeRoute(c)} target="_blank" rel="noreferrer noopener">Waze</a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="section-title">Enquanto você vai</h2>
      <div className="accordion">
        {FIRST_AID.map((item, i) => (
          <div key={item.title} className={`acc-item${open === i ? ' open' : ''}`}>
            <button type="button" className="acc-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {item.title}
              <Icon name="chevron" size={18} className="acc-chevron" />
            </button>
            {open === i && (
              <ol className="acc-body">
                {item.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
            )}
          </div>
        ))}
      </div>
      <p className="muted small disclaimer">Estas orientações não substituem o atendimento veterinário. Na dúvida, ligue para o plantão.</p>
      {!loggedIn && (
        <p className="center"><Link to="/entrar" className="link">Entrar no Vizipet</Link></p>
      )}
    </div>
  );
}
