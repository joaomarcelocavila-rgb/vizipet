import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TopBar } from '../components/Shell';
import { Empty, ErrorNote, Field, Note, Skeleton, Status, Toggle, useToast } from '../components/ui';
import { ApiError, api } from '../lib/api';
import { fmtPhone } from '../lib/format';
import { useGeolocation } from '../lib/geo';
import type { OwnedClinic } from '../lib/types';
import { useLoad } from '../lib/useLoad';
import { VerificationBox } from './Verification';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function ClinicList() {
  const { data, error, reload } = useLoad(() => api.get<{ data: OwnedClinic[] }>('/clinics/mine'), []);

  return (
    <div className="page">
      <TopBar title="Minha clínica" action={<Link to="/clinica/nova" className="btn btn-sm"><Icon name="plus" size={16} /> Nova</Link>} />
      <ErrorNote error={error} onRetry={reload} />
      {!data ? (
        error ? null : <Skeleton rows={2} />
      ) : data.data.length === 0 ? (
        <Empty icon="building" title="Nenhuma clínica cadastrada." action={<Link to="/clinica/nova" className="btn">Cadastrar clínica</Link>}>
          Cadastre o endereço e o telefone para os tutores te encontrarem. Se atende urgência 24h, ela também aparece na tela de emergência.
        </Empty>
      ) : (
        <ul className="list">
          {data.data.map((c) => (
            <li key={c.id}>
              <Link to={`/clinica/${c.id}`} className="card clinic-card">
                <div className="row between">
                  <h3>{c.name}</h3>
                  <Status value={c.verificationStatus} />
                </div>
                <span className="muted small">{c.addressLine}, {c.neighborhood}, {c.city}/{c.state}</span>
                <div className="row wrap">
                  {c.phone && <span className="small"><Icon name="phone" size={14} /> {fmtPhone(c.phone)}</span>}
                  {c.emergency24h && <span className="pill pill-danger">Plantão 24h</span>}
                  {c.latitude === null && <span className="pill pill-warn">Sem localização no mapa</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Form = {
  name: string;
  description: string;
  phone: string;
  addressLine: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  responsibleVet: string;
  responsibleCrmv: string;
  emergency24h: boolean;
};

const BLANK: Form = { name: '', description: '', phone: '', addressLine: '', neighborhood: '', city: '', state: 'PE', latitude: null, longitude: null, responsibleVet: '', responsibleCrmv: '', emergency24h: false };

export function ClinicEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const geo = useGeolocation();
  const existing = useLoad(() => (id ? api.get<{ data: OwnedClinic }>(`/clinics/${id}`) : Promise.resolve(null)), [id]);
  const [form, setForm] = useState<Form>(BLANK);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const clinic = existing.data?.data;
  useEffect(() => {
    if (!clinic) return;
    setForm({
      name: clinic.name,
      description: clinic.description ?? '',
      phone: clinic.phone ?? '',
      addressLine: clinic.addressLine,
      neighborhood: clinic.neighborhood,
      city: clinic.city,
      state: clinic.state,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      responsibleVet: clinic.responsibleVet ?? '',
      responsibleCrmv: clinic.responsibleCrmv ?? '',
      emergency24h: clinic.emergency24h,
    });
  }, [clinic]);

  useEffect(() => {
    if (geo.coords) setForm((f) => ({ ...f, latitude: geo.coords!.lat, longitude: geo.coords!.lng }));
  }, [geo.coords]);

  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    // Campos opcionais vazios não vão no corpo (a API valida o formato quando vêm).
    const body = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== null),
    );
    try {
      if (id) {
        await api.patch(`/clinics/${id}`, body);
        toast('Clínica atualizada.');
        existing.reload();
      } else {
        const res = await api.post<{ data: OwnedClinic }>('/clinics', body);
        toast('Clínica cadastrada. Agora envie os documentos.');
        navigate(`/clinica/${res.data.id}`, { replace: true });
      }
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  if (id && !clinic) {
    return (
      <div className="page">
        <TopBar title="Clínica" back="/clinica" />
        {existing.error ? <ErrorNote error={existing.error} onRetry={existing.reload} /> : <Skeleton rows={4} />}
      </div>
    );
  }

  return (
    <div className="page has-cta">
      <TopBar title={id ? clinic!.name : 'Nova clínica'} back="/clinica" />
      {clinic?.verificationStatus === 'APPROVED' && (
        <Note tone="info">Mudar nome, endereço, responsável ou plantão 24h manda a clínica de volta para análise.</Note>
      )}

      <form id="clinic-form" className="form" onSubmit={save}>
        <h3 className="section-title">Dados da clínica</h3>
        <Field label="Nome"><input value={form.name} onChange={set('name')} required minLength={2} maxLength={120} autoComplete="organization" /></Field>
        <Field label="Telefone" hint="É o número que o tutor liga direto do app.">
          <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="(81) 3333-4444" autoComplete="tel" />
        </Field>
        <Field label="Sobre a clínica (opcional)"><textarea rows={3} value={form.description} onChange={set('description')} maxLength={1000} /></Field>

        <div className="card emergency-toggle">
          <Toggle
            checked={form.emergency24h}
            onChange={(v) => setForm((f) => ({ ...f, emergency24h: v }))}
            label="Atende urgência 24 horas"
            hint="A clínica aparece na tela de emergência, ordenada pela distância do tutor."
          />
        </div>

        <h3 className="section-title">Endereço</h3>
        <Field label="Rua e número"><input value={form.addressLine} onChange={set('addressLine')} required minLength={3} autoComplete="address-line1" /></Field>
        <div className="grid-2">
          <Field label="Bairro"><input value={form.neighborhood} onChange={set('neighborhood')} required minLength={2} /></Field>
          <Field label="Cidade"><input value={form.city} onChange={set('city')} required minLength={2} autoComplete="address-level2" /></Field>
        </div>
        <Field label="Estado">
          <select value={form.state} onChange={set('state')}>{UFS.map((uf) => <option key={uf}>{uf}</option>)}</select>
        </Field>
        <div className="card locate-card">
          <Icon name="pin" />
          <div className="grow">
            <strong>{form.latitude !== null ? 'Localização no mapa definida' : 'Sem localização no mapa'}</strong>
            <span className="muted small">
              {form.latitude !== null
                ? `${form.latitude.toFixed(5)}, ${form.longitude?.toFixed(5)}`
                : 'Sem isso a clínica não aparece em "perto de mim" nem na emergência por distância.'}
            </span>
            {'message' in geo.state && <span className="small error-text">{geo.state.message}</span>}
          </div>
          <button type="button" className="btn btn-soft btn-sm" onClick={geo.request} disabled={geo.state.status === 'asking'}>
            {geo.state.status === 'asking' ? 'Localizando…' : 'Estou na clínica'}
          </button>
        </div>

        <h3 className="section-title">Responsável técnico</h3>
        <div className="grid-2">
          <Field label="Veterinário(a)"><input value={form.responsibleVet} onChange={set('responsibleVet')} /></Field>
          <Field label="CRMV" hint="Formato 12345/PE"><input value={form.responsibleCrmv} onChange={set('responsibleCrmv')} pattern="\d{3,10}/[A-Za-z]{2}" /></Field>
        </div>
        <ErrorNote error={error} />
      </form>

      {clinic && <VerificationBox target="CLINIC" clinicId={clinic.id} status={clinic.verificationStatus} onChange={existing.reload} />}

      <div className="cta-bar">
        <button type="submit" form="clinic-form" className="btn btn-block" disabled={saving}>
          {saving ? 'Salvando…' : id ? 'Salvar alterações' : 'Cadastrar clínica'}
        </button>
      </div>
    </div>
  );
}
