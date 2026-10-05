import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon, IconName } from './Icon';

export interface Tab {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  urgent?: boolean;
  badge?: number;
}

/** Barra inferior no celular; vira trilho lateral em telas largas. */
export function Shell({ tabs, area, children, banner }: { tabs: Tab[]; area: string; children: ReactNode; banner?: ReactNode }) {
  return (
    <div className="shell">
      {banner}
      <nav className="tabbar" aria-label="Navegação principal">
        <div className="rail-brand">
          <span className="logo">vizipet</span>
          <span className="rail-area">{area}</span>
        </div>
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `tab${isActive ? ' active' : ''}${t.urgent ? ' urgent' : ''}`}>
            <span className="tab-icon">
              <Icon name={t.icon} size={t.urgent ? 24 : 22} />
              {!!t.badge && <span className="badge">{t.badge > 9 ? '9+' : t.badge}</span>}
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

/** Cabeçalho de cada tela. Com `back`, mostra a seta de voltar. */
export function TopBar({ title, back, action, sub }: { title: string; back?: boolean | string; action?: ReactNode; sub?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button type="button" className="icon-btn" aria-label="Voltar" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}>
          <Icon name="back" />
        </button>
      )}
      <div className="topbar-title">
        <h1>{title}</h1>
        {sub && <span className="topbar-sub">{sub}</span>}
      </div>
      {action && <div className="topbar-action">{action}</div>}
    </header>
  );
}
