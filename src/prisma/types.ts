import { Prisma } from '../generated/prisma/client';

export type TransactionClient = Prisma.TransactionClient;

export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  if (!field) return true;
  return JSON.stringify(error.meta ?? {}).includes(field);
}

// Violação de EXCLUDE (sobreposição de horários) chega como erro de driver (23P01).
export function isExclusionViolation(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${JSON.stringify((error as any).meta ?? {})}` : '';
  return text.includes('23P01') || text.includes('availability_slots_no_overlap');
}
