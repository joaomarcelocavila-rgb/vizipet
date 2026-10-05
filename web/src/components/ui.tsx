import { ReactNode } from 'react';
import { ApiError } from '../api';

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorNote({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error.message} <code>{error.code}</code>
    </p>
  );
}

export function Loading() {
  return <p className="muted">Carregando…</p>;
}

const STATUS: Record<string, [string, string]> = {
  CONFIRMED: ['Confirmada', 'ok'],
  COMPLETED: ['Concluída', 'neutral'],
  CANCELLED_BY_TUTOR: ['Cancelada pelo tutor', 'warn'],
  CANCELLED_BY_PROVIDER: ['Cancelada pelo profissional', 'warn'],
  AVAILABLE: ['Livre', 'ok'],
  BOOKED: ['Reservado', 'neutral'],
  BLOCKED: ['Bloqueado', 'warn'],
  PENDING: ['Em análise', 'neutral'],
  APPROVED: ['Aprovado', 'ok'],
  CHANGES_REQUESTED: ['Correção pedida', 'warn'],
  REJECTED: ['Rejeitado', 'warn'],
  DRAFT: ['Rascunho', 'neutral'],
  UNDER_REVIEW: ['Em revisão', 'neutral'],
  PUBLISHED: ['Publicada', 'ok'],
  ENDED: ['Encerrada', 'neutral'],
  ARCHIVED: ['Arquivada', 'neutral'],
};

export function Status({ value }: { value: string }) {
  const [label, tone] = STATUS[value] ?? [value, 'neutral'];
  return <span className={`pill pill-${tone}`}>{label}</span>;
}

export const modalityLabel = (m: string) => (m === 'REMOTE' ? 'Online' : 'Presencial');
