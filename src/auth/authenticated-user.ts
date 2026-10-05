export type Role = 'TUTOR' | 'PROFESSIONAL' | 'ADMIN';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  sessionId?: string;
}
