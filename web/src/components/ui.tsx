import { ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import { initial } from '../lib/format';
import { Icon, IconName } from './Icon';

export function Empty({ icon = 'paw', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={28} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  city: 'cidade',
  neighborhood: 'bairro',
  specialty: 'especialidade',
  phone: 'telefone',
  responsibleVet: 'veterinário responsável',
  responsibleCrmv: 'CRMV do responsável',
  'document:CRMV': 'foto da carteira do CRMV',
  'document:IDENTITY': 'documento de identidade',
  'document:CLINIC_LICENSE': 'alvará ou licença da clínica',
};
export const missingLabel = (key: string) => FIELD_LABEL[key] ?? key;

export function ErrorNote({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error) return null;
  const missing = (error.details as { missing?: string[] } | undefined)?.missing;
  return (
    <div className="note note-error" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <span>{error.message}</span>
        {missing && missing.length > 0 && <span className="small"> Falta: {missing.map(missingLabel).join(', ')}.</span>}
        {onRetry && (
          <button type="button" className="link" onClick={onRetry}>Tentar de novo</button>
        )}
      </div>
    </div>
  );
}

export function Note({ tone = 'info', children }: { tone?: 'info' | 'ok' | 'warn'; children: ReactNode }) {
  return <div className={`note note-${tone}`}>{children}</div>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeletons" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" />)}
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  CONFIRMED: ['Confirmada', 'ok'],
  COMPLETED: ['Concluída', 'neutral'],
  CANCELLED_BY_TUTOR: ['Cancelada pelo tutor', 'warn'],
  CANCELLED_BY_PROVIDER: ['Cancelada pela clínica', 'warn'],
  AVAILABLE: ['Livre', 'ok'],
  BOOKED: ['Reservado', 'info'],
  BLOCKED: ['Bloqueado', 'warn'],
  PENDING: ['Em análise', 'info'],
  NOT_SUBMITTED: ['Não enviado', 'neutral'],
  APPROVED: ['Aprovado', 'ok'],
  CHANGES_REQUESTED: ['Correção pedida', 'warn'],
  REJECTED: ['Recusado', 'danger'],
  SUSPENDED: ['Suspenso', 'danger'],
  DRAFT: ['Rascunho', 'neutral'],
  UNDER_REVIEW: ['Em revisão', 'info'],
  PUBLISHED: ['Publicada', 'ok'],
  ENDED: ['Encerrada', 'neutral'],
  ARCHIVED: ['Arquivada', 'neutral'],
  VALID: ['Fonte conferida', 'ok'],
  UNREACHABLE: ['Fonte fora do ar', 'danger'],
  NOT_CHECKED: ['Fonte não conferida', 'neutral'],
};

export function Status({ value }: { value: string }) {
  const [label, tone] = STATUS[value] ?? [value, 'neutral'];
  return <span className={`pill pill-${tone}`}>{label}</span>;
}

export function Avatar({ name, tone = 'green', size = 'md' }: { name: string; tone?: 'green' | 'sand' | 'ink' | 'red'; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`avatar avatar-${tone} avatar-${size}`} aria-hidden="true">{initial(name)}</span>;
}

/** Folha que sobe de baixo no celular e vira janela central no computador. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <header className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="tablist">
      {options.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle-row">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

// Avisos rápidos no rodapé (toast).
const ToastContext = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const show = useCallback((msg: string) => {
    setMessage(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-area" aria-live="polite">
        {message && <div className="toast"><Icon name="check" size={18} />{message}</div>}
      </div>
    </ToastContext.Provider>
  );
}
