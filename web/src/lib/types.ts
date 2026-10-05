export interface Species {
  id: string;
  name: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description?: string | null;
  modality: 'IN_PERSON' | 'REMOTE';
  durationMinutes: number;
  priceCents: number | null;
  species: Species[];
}

export interface PublicClinic {
  id: string;
  name: string;
  description?: string | null;
  phone?: string | null;
  address: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  emergency24h?: boolean;
  distanceKm?: number;
}

export interface ProviderItem {
  id: string;
  name: string;
  specialty: string | null;
  bio: string | null;
  crmv: string;
  city: string | null;
  neighborhood: string | null;
  services: ServiceItem[];
  clinics: PublicClinic[];
  nextAvailableAt?: string | null;
  distanceKm?: number;
}

export interface Slot {
  id: string;
  serviceId: string;
  clinicId: string | null;
  startsAt: string;
  endsAt: string;
  status?: 'AVAILABLE' | 'BOOKED' | 'BLOCKED';
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
}

export interface Appointment {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  cancelReason: string | null;
  snapshot: {
    serviceName: string;
    modality: string;
    priceCents: number | null;
    durationMinutes: number;
    professionalName: string;
    clinicName: string | null;
    clinicAddress: string | null;
    petName: string;
    tutorName: string;
  };
}

export interface Notification {
  id: string;
  type?: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  type: string;
  organization: string;
  audience: string;
  requirements: string;
  location: string;
  startsAt: string;
  endsAt: string;
  sourceUrl: string;
  sourceStatus?: string;
  status?: string;
  verifiedAt: string | null;
}

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'SUSPENDED';

export interface OwnedClinic {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  addressLine: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  responsibleVet: string | null;
  responsibleCrmv: string | null;
  emergency24h: boolean;
  verificationStatus: VerificationStatus;
}

export interface OwnedProfessional {
  id: string;
  displayName: string;
  specialty: string | null;
  bio: string | null;
  crmvNumber: string;
  crmvState: string;
  city: string | null;
  neighborhood: string | null;
  verificationStatus: VerificationStatus;
}

export interface OwnedService {
  id: string;
  name: string;
  description: string | null;
  modality: 'IN_PERSON' | 'REMOTE';
  durationMinutes: number;
  priceCents: number | null;
  active: boolean;
  speciesIds: string[];
}

export interface MyVerificationRequest {
  id: string;
  target: 'PROFESSIONAL' | 'CLINIC';
  professionalId: string | null;
  clinicId: string | null;
  status: string;
  reason: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface VerificationDocument {
  id: string;
  kind: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface AdminRequest {
  id: string;
  target: 'PROFESSIONAL' | 'CLINIC';
  status: string;
  professionalId: string | null;
  clinicId: string | null;
  reason: string | null;
  createdAt: string;
  decidedAt: string | null;
  subject: {
    kind: string;
    name: string;
    crmv?: string;
    city?: string | null;
    state?: string;
    responsibleVet?: string | null;
    responsibleCrmv?: string | null;
    verificationStatus: string;
  } | null;
  documents?: VerificationDocument[];
  missing?: string[];
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
