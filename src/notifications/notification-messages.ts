import { APP_TIME_ZONE } from '../common/utils/time';

export type EmailKind = 'transactional' | 'reminder' | 'security';

export interface Message {
  title: string;
  body: string;
  email: EmailKind;
}

const formatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: APP_TIME_ZONE,
  dateStyle: 'long',
  timeStyle: 'short',
});

export const formatWhen = (iso: unknown) => formatter.format(new Date(String(iso)));

const text = (value: unknown, fallback = '') => (typeof value === 'string' && value ? value : fallback);

export function appointmentConfirmed(p: Record<string, unknown>, recipient: 'tutor' | 'professional'): Message {
  const when = formatWhen(p.startsAt);
  return recipient === 'tutor'
    ? {
        title: 'Consulta confirmada',
        body: `${text(p.serviceName, 'Atendimento')} de ${text(p.petName, 'seu pet')} com ${text(p.professionalName, 'o profissional')} em ${when}.`,
        email: 'transactional',
      }
    : {
        title: 'Nova consulta agendada',
        body: `${text(p.serviceName, 'Atendimento')} com ${text(p.petName, 'um pet')} (tutor: ${text(p.tutorName, 'não informado')}) em ${when}.`,
        email: 'transactional',
      };
}

export function appointmentCancelled(p: Record<string, unknown>): Message {
  const by = p.cancelledBy === 'PROVIDER' ? 'pelo profissional' : 'pelo tutor';
  const reason = text(p.reason) ? ` Motivo: ${text(p.reason)}` : '';
  return {
    title: 'Consulta cancelada',
    body: `${text(p.serviceName, 'O atendimento')} marcado para ${formatWhen(p.startsAt)} foi cancelado ${by}.${reason}`,
    email: 'transactional',
  };
}

export function appointmentReminder(p: Record<string, unknown>): Message {
  return {
    title: 'Lembrete: consulta amanhã',
    body: `${text(p.serviceName, 'Atendimento')} de ${text(p.petName, 'seu pet')} com ${text(p.professionalName, 'o profissional')} em ${formatWhen(p.startsAt)}.`,
    email: 'reminder',
  };
}

export function verificationDecided(p: Record<string, unknown>): Message {
  const subject = p.target === 'CLINIC' ? 'sua clínica' : 'seu perfil profissional';
  const reason = text(p.reason) ? ` Justificativa: ${text(p.reason)}` : '';
  const outcome: Record<string, string> = {
    APPROVED: `A análise de ${subject} foi concluída e o cadastro foi aprovado.`,
    CHANGES_REQUESTED: `A análise de ${subject} pede ajustes antes da aprovação.`,
    REJECTED: `A análise de ${subject} não foi aprovada.`,
    SUSPENDED: `O cadastro de ${subject} foi suspenso.`,
  };
  return {
    title: 'Resultado da verificação',
    body: `${outcome[text(p.decision)] ?? 'Há uma atualização na análise do seu cadastro.'}${reason}`,
    email: 'transactional',
  };
}

export function passwordReset(p: Record<string, unknown>): Message {
  return {
    title: 'Redefinição de senha',
    body: `Use o link para criar uma nova senha (válido por 30 minutos): ${text(p.resetUrl)}\nSe você não pediu, ignore este e-mail.`,
    email: 'security',
  };
}
