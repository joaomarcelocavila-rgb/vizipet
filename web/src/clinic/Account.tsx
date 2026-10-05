import { FormEvent, useEffect, useState } from 'react';
import { TopBar } from '../components/Shell';
import { Avatar, ErrorNote, Field, Skeleton, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { InstallCard } from '../components/Install';
import { ApiError, SessionUser, api } from '../lib/api';
import type { OwnedProfessional } from '../lib/types';
import { useLoad } from '../lib/useLoad';
import { MenuLink } from '../tutor/Profile';
import { VerificationBox } from './Verification';

const BLANK = { displayName: '', specialty: '', bio: '', crmvNumber: '', crmvState: 'PE', city: '', neighborhood: '' };

export function Account({ user, unread, onLogout }: { user: SessionUser; unread: number; onLogout: () => void }) {
  const toast = useToast();
  const me = useLoad(() => api.get<{ data: OwnedProfessional }>('/professionals/me').catch((e: ApiError) => (e.code === 'PROFESSIONAL_NOT_FOUND' || e.status === 404 ? null : Promise.reject(e))), []);
  const [form, setForm] = useState({ ...BLANK, displayName: user.name });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  const profile = me.data?.data;
  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName,
        specialty: profile.specialty ?? '',
        bio: profile.bio ?? '',
        crmvNumber: profile.crmvNumber,
        crmvState: profile.crmvState,
        city: profile.city ?? '',
        neighborhood: profile.neighborhood ?? '',
      });
    }
  }, [profile]);

  const set = (key: keyof typeof BLANK) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ''));
    try {
      if (profile) await api.patch('/professionals/me', body);
      else await api.post('/professionals/me', body);
      toast('Perfil salvo.');
      me.reload();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <TopBar title="Conta" />
      <section className="profile-head">
        <Avatar name={user.name} size="lg" />
        <div>
          <h2>{user.name}</h2>
          <span className="muted small">Clínica / veterinário</span>
        </div>
      </section>

      <div className="menu">
        <MenuLink to="/notificacoes" icon="bell" label="Notificações" badge={unread} />
        <MenuLink to="/clinica" icon="building" label="Minhas clínicas" />
        <InstallCard compact />
      </div>

      <h3 className="section-title">Perfil profissional</h3>
      {me.loading && me.data === null ? (
        <Skeleton rows={3} />
      ) : (
        <>
          {!profile && <p className="muted small">Você ainda não tem perfil profissional. Preencha para aparecer na busca dos tutores.</p>}
          <form className="form card" onSubmit={save}>
            <Field label="Nome de exibição"><input value={form.displayName} onChange={set('displayName')} required minLength={2} /></Field>
            <Field label="Especialidade"><input value={form.specialty} onChange={set('specialty')} placeholder="Ex.: Clínica geral" /></Field>
            <div className="grid-2">
              <Field label="CRMV"><input inputMode="numeric" value={form.crmvNumber} onChange={set('crmvNumber')} required pattern="\d{3,10}" /></Field>
              <Field label="UF do CRMV"><input value={form.crmvState} onChange={set('crmvState')} required maxLength={2} /></Field>
              <Field label="Cidade"><input value={form.city} onChange={set('city')} /></Field>
              <Field label="Bairro"><input value={form.neighborhood} onChange={set('neighborhood')} /></Field>
            </div>
            <Field label="Sobre você"><textarea rows={3} value={form.bio} onChange={set('bio')} /></Field>
            <ErrorNote error={error} />
            <button type="submit" className="btn btn-block" disabled={saving}>{saving ? 'Salvando…' : profile ? 'Salvar perfil' : 'Criar perfil'}</button>
          </form>
          {profile && <VerificationBox target="PROFESSIONAL" status={profile.verificationStatus} onChange={me.reload} />}
        </>
      )}

      <button type="button" className="menu-item danger standalone" onClick={onLogout}>
        <Icon name="logout" /> <span className="grow">Sair</span>
      </button>
    </div>
  );
}
