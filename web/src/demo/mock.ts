/**
 * Back end simulado no navegador, usado só no build de demonstração (VITE_DEMO=1).
 * Reproduz as respostas e as regras principais da API real com dados parecidos com os do seed.
 */
type Json = Record<string, any>;
interface Result { status: number; body?: Json }

const KEY = 'vizipet.demo.v3';
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16));
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const recifeDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
// Recife é UTC−3 o ano todo.
const atRecife = (daysAhead: number, hh: number, mm = 0) => {
  const base = new Date(`${recifeDay(new Date(Date.now() + daysAhead * DAY))}T00:00:00-03:00`);
  return new Date(base.getTime() + (hh * 60 + mm) * 60000);
};
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

function seed() {
  const dog = { id: 'sp-dog', name: 'Cachorro' };
  const cat = { id: 'sp-cat', name: 'Gato' };
  const users = [
    { id: 'u-tutor', email: 'tutor@vizipet.test', name: 'Marina Tutora', role: 'TUTOR' },
    { id: 'u-carlos', email: 'vet@vizipet.test', name: 'Dr. Carlos Veterinário', role: 'PROFESSIONAL' },
    { id: 'u-lucia', email: 'dermato@vizipet.test', name: 'Dra. Lúcia Andrade', role: 'PROFESSIONAL' },
    { id: 'u-rafael', email: 'felinos@vizipet.test', name: 'Dr. Rafael Moura', role: 'PROFESSIONAL' },
    { id: 'u-paula', email: 'nova@vizipet.test', name: 'Dra. Paula Nunes', role: 'PROFESSIONAL' },
    { id: 'u-admin', email: 'admin@vizipet.test', name: 'Admin Vizipet', role: 'ADMIN' },
  ];
  const pro = (id: string, userId: string, displayName: string, specialty: string, bio: string, crmvNumber: string, city: string, neighborhood: string, lat: number, lng: number, verificationStatus = 'APPROVED') =>
    ({ id, userId, displayName, specialty, bio, crmvNumber, crmvState: 'PE', city, neighborhood, latitude: lat as number | null, longitude: lng as number | null, verificationStatus });
  const professionals = [
    pro('p-carlos', 'u-carlos', 'Dr. Carlos Veterinário', 'Clínica geral', 'Atendimento clínico de cães e gatos, com plantão 24h na Pata Feliz.', '12345', 'Recife', 'Boa Viagem', -8.119, -34.9),
    pro('p-lucia', 'u-lucia', 'Dra. Lúcia Andrade', 'Dermatologia', 'Alergias, otites e problemas de pele em cães e gatos.', '23456', 'Recife', 'Graças', -8.0476, -34.8986),
    pro('p-rafael', 'u-rafael', 'Dr. Rafael Moura', 'Medicina felina', 'Atendimento exclusivo para gatos, também por vídeo.', '34567', 'Olinda', 'Casa Caiada', -8.0089, -34.8553),
    pro('p-paula', 'u-paula', 'Dra. Paula Nunes', 'Ortopedia', 'Ortopedia e reabilitação de cães.', '45678', 'Jaboatão dos Guararapes', 'Piedade', -8.1667, -34.9167, 'PENDING'),
  ];
  const clinic = (id: string, ownerId: string | null, name: string, phone: string, addressLine: string, neighborhood: string, city: string, lat: number | null, lng: number | null, emergency24h: boolean, professionalIds: string[], description: string | null = null) => ({
    id, ownerId, name, description, phone, addressLine, neighborhood, city, state: 'PE', latitude: lat, longitude: lng,
    responsibleVet: ownerId ? users.find((u) => u.id === ownerId)!.name : 'Equipe de plantão', responsibleCrmv: '12345/PE',
    emergency24h, verificationStatus: 'APPROVED', professionalIds,
  });
  const clinics = [
    clinic('c-patafeliz', 'u-carlos', 'Clínica Pata Feliz', '8133334444', 'Av. Conselheiro Aguiar, 1000', 'Boa Viagem', 'Recife', -8.119, -34.9, true, ['p-carlos'], 'Clínica geral e plantão 24 horas para cães e gatos.'),
    clinic('c-derma', 'u-lucia', 'Derma Pet Graças', '8132221111', 'Rua das Graças, 210', 'Graças', 'Recife', -8.0476, -34.8986, false, ['p-lucia']),
    clinic('c-hv24', null, 'Hospital Veterinário Plantão 24h', '8130305050', 'Rua Real da Torre, 500', 'Madalena', 'Recife', -8.0526, -34.9089, true, [], 'Atendimento de urgência 24 horas, inclusive fins de semana e feriados.'),
    clinic('c-olinda', null, 'Pronto Socorro Animal Olinda', '8134291010', 'Av. Getúlio Vargas, 1200', 'Bairro Novo', 'Olinda', -8.0102, -34.8462, true, [], 'Urgência e internação 24 horas.'),
    clinic('c-jaboatao', null, 'Vet Emergência Jaboatão', '8134623030', 'Av. Bernardo Vieira de Melo, 3000', 'Piedade', 'Jaboatão dos Guararapes', -8.1781, -34.9178, true, [], 'Plantão 24 horas com centro cirúrgico.'),
  ];
  const services = [
    { id: 's-consulta', ownerId: 'u-carlos', name: 'Consulta clínica', description: 'Avaliação geral de saúde', modality: 'IN_PERSON', durationMinutes: 30, priceCents: 15000, active: true, speciesIds: [dog.id, cat.id], professionalIds: ['p-carlos'] },
    { id: 's-vacina', ownerId: 'u-carlos', name: 'Vacinação', description: null, modality: 'IN_PERSON', durationMinutes: 20, priceCents: 9000, active: true, speciesIds: [dog.id, cat.id], professionalIds: ['p-carlos'] },
    { id: 's-derma', ownerId: 'u-lucia', name: 'Consulta dermatológica', description: null, modality: 'IN_PERSON', durationMinutes: 40, priceCents: 22000, active: true, speciesIds: [dog.id, cat.id], professionalIds: ['p-lucia'] },
    { id: 's-tele', ownerId: 'u-rafael', name: 'Teleorientação felina', description: null, modality: 'REMOTE', durationMinutes: 20, priceCents: 9000, active: true, speciesIds: [cat.id], professionalIds: ['p-rafael'] },
  ];
  const plans: [string, string, string | null, number, number, number][] = [
    ['p-carlos', 's-consulta', 'c-patafeliz', 0, 17, 4], ['p-carlos', 's-consulta', 'c-patafeliz', 1, 9, 6], ['p-carlos', 's-vacina', 'c-patafeliz', 2, 14, 4],
    ['p-lucia', 's-derma', 'c-derma', 1, 14, 4], ['p-lucia', 's-derma', 'c-derma', 3, 14, 4], ['p-lucia', 's-derma', 'c-derma', 4, 14, 4],
    ['p-rafael', 's-tele', null, 1, 14, 4], ['p-rafael', 's-tele', null, 2, 14, 4], ['p-rafael', 's-tele', null, 5, 14, 4],
  ];
  const slots: Json[] = [];
  for (const [professionalId, serviceId, clinicId, days, hour, count] of plans) {
    const duration = services.find((s) => s.id === serviceId)!.durationMinutes;
    for (let i = 0; i < count; i++) {
      const startsAt = new Date(atRecife(days, hour).getTime() + i * duration * 60000);
      slots.push({ id: uid(), professionalId, serviceId, clinicId, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + duration * 60000).toISOString(), status: 'AVAILABLE' });
    }
  }
  return {
    createdAt: Date.now(),
    species: [dog, cat],
    users,
    professionals,
    clinics,
    services,
    slots,
    pets: [
      { id: 'pet-luna', ownerId: 'u-tutor', name: 'Luna', species: dog },
      { id: 'pet-mingau', ownerId: 'u-tutor', name: 'Mingau', species: cat },
    ],
    appointments: [] as Json[],
    notifications: [] as Json[],
    idempotency: {} as Record<string, { hash: string; appointmentId: string }>,
    documents: [
      { id: 'doc-paula-crmv', professionalId: 'p-paula', clinicId: null, kind: 'CRMV', originalName: 'crmv-paula.pdf', mimeType: 'application/pdf', sizeBytes: 182000, createdAt: iso(6 * HOUR) },
      { id: 'doc-paula-rg', professionalId: 'p-paula', clinicId: null, kind: 'IDENTITY', originalName: 'rg-paula.jpg', mimeType: 'image/jpeg', sizeBytes: 420000, createdAt: iso(6 * HOUR) },
    ] as Json[],
    requests: [
      { id: 'vr-paula', target: 'PROFESSIONAL', professionalId: 'p-paula', clinicId: null, status: 'PENDING', reason: null, decidedAt: null, decidedById: null, createdAt: iso(5 * HOUR) },
    ] as Json[],
    campaigns: [
      { id: 'cp-raiva', title: 'Vacinação antirrábica gratuita', type: 'VACINACAO', organization: 'Prefeitura do Recife', audience: 'Cães e gatos a partir de 3 meses', requirements: 'Levar o animal com coleira ou caixa de transporte', location: 'Postos de vacinação em todos os distritos sanitários', startsAt: iso(2 * DAY), endsAt: iso(-20 * DAY), sourceUrl: 'https://www2.recife.pe.gov.br/', sourceStatus: 'VALID', status: 'PUBLISHED', verifiedAt: iso(DAY) },
      { id: 'cp-castra', title: 'Castração solidária', type: 'CASTRACAO', organization: 'Governo de Pernambuco', audience: 'Tutores inscritos no CadÚnico', requirements: 'Agendamento prévio e jejum de 8 horas', location: 'Hospital Veterinário Público', startsAt: iso(DAY), endsAt: iso(-40 * DAY), sourceUrl: 'https://www.pe.gov.br/', sourceStatus: 'VALID', status: 'PUBLISHED', verifiedAt: iso(DAY) },
      { id: 'cp-adocao', title: 'Feira de adoção responsável', type: 'ADOCAO', organization: 'Prefeitura de Olinda', audience: 'Maiores de 18 anos com comprovante de residência', requirements: 'Documento com foto', location: 'Praça do Carmo, Olinda', startsAt: iso(-3 * DAY), endsAt: iso(-4 * DAY), sourceUrl: 'https://www.olinda.pe.gov.br/', sourceStatus: 'NOT_CHECKED', status: 'UNDER_REVIEW', verifiedAt: null },
    ] as Json[],
    audit: [] as Json[],
  };
}

type State = ReturnType<typeof seed>;
type User = State['users'][number];
let state: State = load();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      // Os horários são relativos a hoje; depois de um dia a demonstração recomeça.
      if (Date.now() - parsed.createdAt < DAY) return parsed;
    }
  } catch { /* armazenamento indisponível: segue em memória */ }
  return seed();
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignora */ }
}

export function resetDemo() {
  state = seed();
  save();
}

const ok = (data: unknown, status = 200): Result => ({ status, body: { data } });
const page = (items: unknown[], pageNo = 1, limit = 20, extra: Json = {}): Result => ({
  status: 200,
  body: { data: items.slice((pageNo - 1) * limit, pageNo * limit), meta: { page: pageNo, limit, total: items.length, totalPages: Math.ceil(items.length / limit), ...extra } },
});
const fail = (status: number, code: string, message: string, details?: unknown): Result => ({ status, body: { statusCode: status, code, message, requestId: uid(), ...(details ? { details } : {}) } });

const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
};

const address = (c: Json) => `${c.addressLine}, ${c.neighborhood}, ${c.city}/${c.state}`;
const publicClinic = (c: Json) => ({
  id: c.id, name: c.name, description: c.description, phone: c.phone, address: address(c), neighborhood: c.neighborhood, city: c.city, state: c.state,
  latitude: c.latitude, longitude: c.longitude, emergency24h: c.emergency24h,
});
const speciesOf = (ids: string[]) => state.species.filter((s) => ids.includes(s.id));
const publicService = (s: Json) => ({ id: s.id, name: s.name, description: s.description, modality: s.modality, durationMinutes: s.durationMinutes, priceCents: s.priceCents, species: speciesOf(s.speciesIds) });
const servicesOf = (p: Json) => state.services.filter((s) => s.active && s.professionalIds.includes(p.id));
const clinicsOf = (p: Json) => state.clinics.filter((c) => c.verificationStatus === 'APPROVED' && c.professionalIds.includes(p.id));
const isPublic = (p: Json) => p.verificationStatus === 'APPROVED';

const nextSlot = (professionalId: string, filter: (s: Json) => boolean = () => true) =>
  state.slots
    .filter((s) => s.professionalId === professionalId && s.status === 'AVAILABLE' && new Date(s.startsAt) > new Date() && state.services.find((x) => x.id === s.serviceId)?.active && filter(s))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.startsAt ?? null;

function publicProvider(p: Json) {
  return {
    id: p.id, name: p.displayName, specialty: p.specialty, bio: p.bio, crmv: `${p.crmvNumber}/${p.crmvState}`, city: p.city, neighborhood: p.neighborhood,
    services: servicesOf(p).map(publicService), clinics: clinicsOf(p).map(publicClinic), nextAvailableAt: nextSlot(p.id),
  };
}

function notify(userId: string | null, type: string, title: string, body: string) {
  if (!userId) return;
  state.notifications.unshift({ id: uid(), userId, type, title, body, readAt: null, createdAt: new Date().toISOString() });
}

function audit(actorId: string, action: string, entityType: string, entityId: string, metadata: Json | null = null) {
  state.audit.unshift({ id: uid(), actorId, action, entityType, entityId, metadata, createdAt: new Date().toISOString() });
}

const when = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'long', timeStyle: 'short' }).replace(',', ' às');

function currentUser(token: string | null) {
  const id = token?.startsWith('demo:') ? token.slice(5) : null;
  return state.users.find((u) => u.id === id) ?? null;
}

// FormData (upload de documento) vira objeto simples.
function plain(body: unknown): Json {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out: Json = {};
    body.forEach((v, k) => { out[k] = v; });
    return out;
  }
  return (body as Json) ?? {};
}

export async function demoRequest(method: string, fullPath: string, body: unknown, headers: Record<string, string>, token: string | null): Promise<Result> {
  await new Promise((r) => setTimeout(r, 120));
  const [path, qs] = fullPath.split('?');
  const q = new URLSearchParams(qs ?? '');
  const seg = path.split('/').filter(Boolean);
  const result = route(method, seg, q, plain(body), headers, currentUser(token));
  if (method !== 'GET') save();
  return result;
}

function route(method: string, seg: string[], q: URLSearchParams, body: Json, headers: Record<string, string>, me: User | null): Result {
  const at = (...parts: string[]) => parts.length === seg.length && parts.every((p, i) => p === '*' || p === seg[i]);
  const limit = Math.min(Number(q.get('limit') ?? 20), 50);

  // ---------- públicas ----------
  if (method === 'GET' && at('dev', 'users')) return ok(state.users.map(({ email, name, role }) => ({ email, name, role })));
  if (method === 'POST' && at('dev', 'login')) {
    const user = state.users.find((u) => u.email === body.email);
    if (!user) return fail(404, 'USER_NOT_FOUND', 'Usuário de teste não encontrado.');
    return ok({ accessToken: `demo:${user.id}`, user: { id: user.id, name: user.name, role: user.role } }, 201);
  }
  if (method === 'GET' && at('species')) return ok(state.species);
  if (method === 'GET' && at('campaigns')) {
    const now = new Date().toISOString();
    return page(state.campaigns.filter((c) => c.status === 'PUBLISHED' && c.startsAt <= now && c.endsAt >= now).sort((a, b) => a.endsAt.localeCompare(b.endsAt)), 1, limit);
  }
  if (method === 'GET' && at('search', 'professionals')) return searchProviders(q, limit);
  if (method === 'GET' && at('search', 'clinics')) return searchClinics(q, limit);
  if (method === 'GET' && at('search', 'professionals', '*')) {
    const p = state.professionals.find((x) => x.id === seg[2] && isPublic(x));
    return p ? ok(publicProvider(p)) : fail(404, 'PROFESSIONAL_NOT_FOUND', 'Profissional não encontrado.');
  }
  if (method === 'GET' && at('search', 'professionals', '*', 'slots')) {
    const serviceId = q.get('serviceId');
    const list = state.slots
      .filter((s) => s.professionalId === seg[2] && s.status === 'AVAILABLE' && new Date(s.startsAt) > new Date() && (!serviceId || s.serviceId === serviceId))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 100);
    return ok(list.map(({ id, serviceId: sid, clinicId, startsAt, endsAt }) => ({ id, serviceId: sid, clinicId, startsAt, endsAt })));
  }

  if (!me) return fail(401, 'UNAUTHORIZED', 'Autenticação ausente ou expirada.');
  const denied = fail(403, 'ACCESS_DENIED', 'Você não tem permissão para esta operação.');
  const provider = state.professionals.find((p) => p.userId === me.id);

  // ---------- notificações ----------
  if (method === 'GET' && at('notifications')) {
    const mine = state.notifications.filter((n) => n.userId === me.id);
    return page(mine, 1, limit, { unread: mine.filter((n) => !n.readAt).length });
  }
  if (method === 'POST' && at('notifications', 'read-all')) {
    let updated = 0;
    for (const n of state.notifications) if (n.userId === me.id && !n.readAt) { n.readAt = new Date().toISOString(); updated++; }
    return ok({ updated }, 201);
  }

  if (method === 'GET' && at('dev', 'pets')) {
    if (me.role !== 'TUTOR') return denied;
    return ok(state.pets.filter((p) => p.ownerId === me.id));
  }

  // ---------- agendamentos ----------
  if (method === 'POST' && at('appointments')) return createAppointment(me, body, headers);
  const visible = (a: Json) => (me.role === 'TUTOR' ? a.tutorId === me.id : a.professionalId === provider?.id);
  if (method === 'GET' && at('appointments')) {
    if (me.role === 'ADMIN') return denied;
    const now = new Date().toISOString();
    const scope = q.get('scope') ?? 'upcoming';
    let list = state.appointments.filter(visible);
    if (scope === 'upcoming') list = list.filter((a) => a.status === 'CONFIRMED' && a.endsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    else if (scope === 'past') list = list.filter((a) => a.status === 'COMPLETED' || (a.status === 'CONFIRMED' && a.endsAt <= now)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    else list = list.filter((a) => a.status.startsWith('CANCELLED')).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return page(list, 1, limit);
  }
  if (method === 'POST' && at('appointments', '*', 'cancel')) {
    const a = state.appointments.find((x) => x.id === seg[1] && visible(x));
    if (!a) return fail(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    const byProvider = me.role === 'PROFESSIONAL';
    if (byProvider && !body.reason) return fail(400, 'VALIDATION_ERROR', 'Informe o motivo do cancelamento.');
    if (a.status.startsWith('CANCELLED')) return fail(409, 'APPOINTMENT_ALREADY_CANCELLED', 'Este agendamento já foi cancelado.');
    if (a.status === 'COMPLETED') return fail(409, 'APPOINTMENT_ALREADY_COMPLETED', 'Esta consulta já foi concluída.');
    if (new Date(a.startsAt) <= new Date()) return fail(409, 'APPOINTMENT_ALREADY_STARTED', 'A consulta já começou e não pode ser cancelada.');
    a.status = byProvider ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_TUTOR';
    a.cancelReason = body.reason ?? null;
    const slot = state.slots.find((s) => s.id === a.slotId);
    if (slot && slot.status === 'BOOKED') slot.status = 'AVAILABLE';
    const other = byProvider ? a.tutorId : state.professionals.find((p) => p.id === a.professionalId)!.userId;
    notify(other, 'APPOINTMENT_CANCELLED', 'Consulta cancelada',
      `${a.snapshot.serviceName} marcado para ${when(a.startsAt)} foi cancelado ${byProvider ? 'pela clínica' : 'pelo tutor'}.${a.cancelReason ? ` Motivo: ${a.cancelReason}` : ''}`);
    return ok(a);
  }
  if (method === 'POST' && at('appointments', '*', 'complete')) {
    const a = state.appointments.find((x) => x.id === seg[1] && visible(x));
    if (!a || me.role !== 'PROFESSIONAL') return fail(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    if (a.status !== 'CONFIRMED') return fail(409, 'INVALID_STATE', 'Só consultas confirmadas podem ser concluídas.');
    if (new Date(a.startsAt) > new Date()) return fail(409, 'APPOINTMENT_NOT_STARTED', 'A consulta ainda não começou.');
    a.status = 'COMPLETED';
    return ok(a);
  }

  // ---------- área da clínica / profissional ----------
  if (seg[0] === 'professionals' || seg[0] === 'services' || seg[0] === 'clinics' || seg[0] === 'availability' || seg[0] === 'verification') {
    if (me.role !== 'PROFESSIONAL') return denied;
    return clinicArea(method, seg, at, q, body, me, provider);
  }

  // ---------- administração ----------
  if (seg[0] === 'admin') {
    if (me.role !== 'ADMIN') return denied;
    return adminArea(method, seg, at, q, body, me, limit);
  }

  return fail(404, 'NOT_FOUND', 'Recurso não encontrado.');
}

function createAppointment(me: User, body: Json, headers: Record<string, string>): Result {
  if (me.role !== 'TUTOR') return fail(403, 'ACCESS_DENIED', 'Você não tem permissão para esta operação.');
  const key = headers['Idempotency-Key'];
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return fail(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Envie o cabeçalho Idempotency-Key.');
  const hash = JSON.stringify([body.petId, body.serviceId, body.professionalId, body.clinicId ?? null, body.slotId]);
  const previous = state.idempotency[`${me.id}:${key}`];
  if (previous) {
    if (previous.hash !== hash) return fail(409, 'IDEMPOTENCY_KEY_REUSED', 'Esta Idempotency-Key já foi usada com outros dados.');
    return ok(state.appointments.find((a) => a.id === previous.appointmentId), 201);
  }
  const pet = state.pets.find((p) => p.id === body.petId);
  if (!pet) return fail(404, 'PET_NOT_FOUND', 'Pet não encontrado.');
  if (pet.ownerId !== me.id) return fail(403, 'PET_NOT_OWNED', 'Este pet pertence a outro tutor.');
  const p = state.professionals.find((x) => x.id === body.professionalId && isPublic(x));
  const service = p && servicesOf(p).find((s) => s.id === body.serviceId);
  if (!p || !service) return fail(409, 'SERVICE_NOT_AVAILABLE', 'Este serviço não está disponível.');
  if (!service.speciesIds.includes(pet.species.id)) return fail(409, 'SERVICE_NOT_AVAILABLE', 'Este serviço não atende a espécie do pet.');
  const slot = state.slots.find((s) => s.id === body.slotId && s.professionalId === p.id && s.serviceId === service.id);
  if (!slot || slot.status !== 'AVAILABLE' || new Date(slot.startsAt) <= new Date()) {
    return fail(409, 'SLOT_NOT_AVAILABLE', 'Este horário acabou de ser ocupado. Escolha outro.');
  }
  slot.status = 'BOOKED';
  const clinic = state.clinics.find((c) => c.id === slot.clinicId);
  const appointment = {
    id: uid(), status: 'CONFIRMED', startsAt: slot.startsAt, endsAt: slot.endsAt, slotId: slot.id, tutorId: me.id, professionalId: p.id,
    cancelReason: null, createdAt: new Date().toISOString(),
    snapshot: {
      serviceName: service.name, durationMinutes: service.durationMinutes, modality: service.modality, priceCents: service.priceCents,
      professionalName: p.displayName, clinicName: clinic?.name ?? null, clinicAddress: clinic ? address(clinic) : null, petName: pet.name, tutorName: me.name,
    },
  };
  state.appointments.push(appointment);
  state.idempotency[`${me.id}:${key}`] = { hash, appointmentId: appointment.id };
  notify(me.id, 'APPOINTMENT_CONFIRMED', 'Consulta confirmada', `${service.name} de ${pet.name} com ${p.displayName} em ${when(slot.startsAt)}.`);
  notify(p.userId, 'APPOINTMENT_CONFIRMED', 'Nova consulta agendada', `${service.name} com ${pet.name} (tutor: ${me.name}) em ${when(slot.startsAt)}.`);
  return ok(appointment, 201);
}

function searchProviders(q: URLSearchParams, limit: number): Result {
  const text = norm(q.get('q') ?? '');
  const city = norm(q.get('city') ?? '');
  const speciesId = q.get('speciesId');
  const modality = q.get('modality');
  const date = q.get('date');
  const lat = q.get('lat') ? Number(q.get('lat')) : null;
  const lng = q.get('lng') ? Number(q.get('lng')) : null;
  const sort = q.get('sort') ?? 'availability';
  if (sort === 'distance' && lat === null) return fail(400, 'LOCATION_REQUIRED', 'Ordenar por distância exige lat e lng.');
  const list = state.professionals
    .filter(isPublic)
    .filter((p) => {
      const services = servicesOf(p);
      const haystack = norm([p.displayName, p.specialty, p.city, p.neighborhood, ...clinicsOf(p).map((c) => c.name), ...services.map((s) => s.name)].join(' '));
      if (text && !haystack.includes(text)) return false;
      if (city && !norm(p.city ?? '').includes(city)) return false;
      const matching = services.filter((s) => (!modality || s.modality === modality) && (!speciesId || s.speciesIds.includes(speciesId)));
      if ((modality || speciesId) && matching.length === 0) return false;
      if (date && !nextSlot(p.id, (s) => recifeDay(new Date(s.startsAt)) === date && matching.concat(modality || speciesId ? [] : services).some((x) => x.id === s.serviceId))) return false;
      return true;
    })
    .map((p) => ({ ...publicProvider(p), ...(lat !== null && lng !== null && p.latitude != null ? { distanceKm: haversine(lat, lng, p.latitude, p.longitude!) } : {}) }))
    .sort((a: Json, b: Json) =>
      sort === 'name' ? norm(a.name).localeCompare(norm(b.name))
        : sort === 'distance' ? (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9)
          : (a.nextAvailableAt ?? '9').localeCompare(b.nextAvailableAt ?? '9') || a.name.localeCompare(b.name));
  return page(list, 1, limit);
}

function searchClinics(q: URLSearchParams, limit: number): Result {
  const text = norm(q.get('q') ?? '');
  const emergency = q.get('emergency');
  if (emergency && emergency !== 'true' && emergency !== 'false') return fail(400, 'VALIDATION_ERROR', 'emergency deve ser true ou false.');
  const lat = q.get('lat') ? Number(q.get('lat')) : null;
  const lng = q.get('lng') ? Number(q.get('lng')) : null;
  if ((lat === null) !== (lng === null)) return fail(400, 'VALIDATION_ERROR', 'Informe lat e lng juntos.');
  const list = state.clinics
    .filter((c) => c.verificationStatus === 'APPROVED')
    .filter((c) => emergency === null || c.emergency24h === (emergency === 'true'))
    .filter((c) => !text || norm(`${c.name} ${c.city} ${c.neighborhood}`).includes(text))
    .map((c) => ({ ...publicClinic(c), ...(lat !== null && lng !== null && c.latitude != null ? { distanceKm: haversine(lat, lng, c.latitude, c.longitude!) } : {}) }))
    .sort((a: Json, b: Json) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9) || norm(a.name).localeCompare(norm(b.name)));
  return page(list, 1, limit);
}

const SENSITIVE_CLINIC = ['name', 'addressLine', 'neighborhood', 'city', 'state', 'responsibleVet', 'responsibleCrmv', 'emergency24h'];
const SENSITIVE_PRO = ['displayName', 'crmvNumber', 'crmvState', 'specialty'];

function missingFor(target: string, entity: Json) {
  const missing: string[] = [];
  const kinds = new Set(state.documents.filter((d) => (target === 'CLINIC' ? d.clinicId === entity.id : d.professionalId === entity.id)).map((d) => d.kind));
  if (target === 'PROFESSIONAL') {
    if (!entity.city) missing.push('city');
    if (!entity.neighborhood) missing.push('neighborhood');
    if (!entity.specialty) missing.push('specialty');
    if (!kinds.has('CRMV')) missing.push('document:CRMV');
    if (!kinds.has('IDENTITY')) missing.push('document:IDENTITY');
  } else {
    if (!entity.responsibleVet) missing.push('responsibleVet');
    if (!entity.responsibleCrmv) missing.push('responsibleCrmv');
    if (!entity.phone) missing.push('phone');
    if (!kinds.has('CLINIC_LICENSE')) missing.push('document:CLINIC_LICENSE');
  }
  return missing;
}

const clinicOwnerView = ({ professionalIds: _p, ...c }: Json) => c;

function clinicArea(method: string, seg: string[], at: (...p: string[]) => boolean, q: URLSearchParams, body: Json, me: User, provider: Json | undefined): Result {
  const noProfile = fail(404, 'PROFESSIONAL_NOT_FOUND', 'Cadastre seu perfil profissional primeiro.');

  // perfil profissional
  if (at('professionals', 'me')) {
    if (method === 'GET') return provider ? ok(provider) : noProfile;
    if (method === 'POST') {
      if (provider) return fail(409, 'PROFESSIONAL_ALREADY_EXISTS', 'Você já possui um perfil profissional.');
      const created = { id: uid(), userId: me.id, displayName: body.displayName, specialty: body.specialty ?? null, bio: body.bio ?? null, crmvNumber: body.crmvNumber, crmvState: (body.crmvState ?? '').toUpperCase(), city: body.city ?? null, neighborhood: body.neighborhood ?? null, latitude: null, longitude: null, verificationStatus: 'PENDING' };
      state.professionals.push(created);
      return ok(created, 201);
    }
    if (method === 'PATCH') {
      if (!provider) return noProfile;
      const changed = SENSITIVE_PRO.some((k) => body[k] !== undefined && body[k] !== provider[k]);
      Object.assign(provider, body);
      if (changed && provider.verificationStatus === 'APPROVED') provider.verificationStatus = 'PENDING';
      return ok(provider);
    }
  }

  // serviços
  if (method === 'GET' && at('services', 'mine')) return ok(state.services.filter((s) => s.ownerId === me.id).map(({ professionalIds, ...s }) => ({ ...s, professionalIds })));
  if (method === 'POST' && at('services')) {
    if (!body.name || !body.speciesIds?.length) return fail(400, 'VALIDATION_ERROR', 'Informe nome e ao menos uma espécie.');
    if (!(body.durationMinutes >= 5 && body.durationMinutes <= 480)) return fail(400, 'VALIDATION_ERROR', 'A duração deve ficar entre 5 e 480 minutos.');
    const created = { id: uid(), ownerId: me.id, name: body.name, description: body.description ?? null, modality: body.modality, durationMinutes: body.durationMinutes, priceCents: body.priceCents ?? null, active: true, speciesIds: body.speciesIds, professionalIds: provider ? [provider.id] : [] };
    state.services.push(created);
    return ok(created, 201);
  }
  if (method === 'PATCH' && at('services', '*')) {
    const s = state.services.find((x) => x.id === seg[1] && x.ownerId === me.id);
    if (!s) return fail(404, 'SERVICE_NOT_FOUND', 'Serviço não encontrado.');
    Object.assign(s, body);
    return ok(s);
  }

  // clínicas
  const owned = (id: string) => state.clinics.find((c) => c.id === id && c.ownerId === me.id);
  if (method === 'GET' && at('clinics', 'mine')) return ok(state.clinics.filter((c) => c.ownerId === me.id).map(clinicOwnerView));
  if (method === 'POST' && at('clinics')) {
    for (const k of ['name', 'addressLine', 'neighborhood', 'city', 'state']) if (!body[k]) return fail(400, 'VALIDATION_ERROR', `Preencha o campo ${k}.`);
    if (body.responsibleCrmv && !/^\d{3,10}\/[A-Za-z]{2}$/.test(body.responsibleCrmv)) return fail(400, 'VALIDATION_ERROR', 'CRMV do responsável: use o formato 12345/PE.');
    const created = { id: uid(), ownerId: me.id, description: null, phone: null, latitude: null, longitude: null, responsibleVet: null, responsibleCrmv: null, emergency24h: false, ...body, verificationStatus: 'PENDING', professionalIds: provider ? [provider.id] : [] };
    state.clinics.push(created as any);
    return ok(clinicOwnerView(created), 201);
  }
  if (at('clinics', '*')) {
    const c = owned(seg[1]);
    if (!c) return fail(404, 'CLINIC_NOT_FOUND', 'Clínica não encontrada.');
    if (method === 'GET') return ok(clinicOwnerView(c));
    if (method === 'PATCH') {
      if (body.responsibleCrmv && !/^\d{3,10}\/[A-Za-z]{2}$/.test(body.responsibleCrmv)) return fail(400, 'VALIDATION_ERROR', 'CRMV do responsável: use o formato 12345/PE.');
      const changed = SENSITIVE_CLINIC.some((k) => body[k] !== undefined && body[k] !== (c as Json)[k]);
      Object.assign(c, body);
      if (changed && c.verificationStatus === 'APPROVED') c.verificationStatus = 'PENDING';
      return ok(clinicOwnerView(c));
    }
  }

  // horários
  if (!provider && seg[0] === 'availability') return noProfile;
  if (method === 'GET' && at('availability', 'mine')) {
    const list = state.slots
      .filter((s) => s.professionalId === provider!.id && new Date(s.endsAt) > new Date(Date.now() - 12 * HOUR))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return page(list, 1, Math.min(Number(q.get('limit') ?? 50), 50));
  }
  if (method === 'PATCH' && at('availability', '*', '*')) {
    const slot = state.slots.find((s) => s.id === seg[1] && s.professionalId === provider!.id);
    if (!slot) return fail(404, 'SLOT_NOT_FOUND', 'Horário não encontrado.');
    const [from, to] = seg[2] === 'block' ? ['AVAILABLE', 'BLOCKED'] : ['BLOCKED', 'AVAILABLE'];
    if (slot.status !== from) return fail(409, 'SLOT_NOT_AVAILABLE', 'O estado atual do horário não permite essa operação.');
    slot.status = to;
    return ok(slot);
  }
  if (method === 'POST' && at('availability', 'batch')) {
    const service = state.services.find((s) => s.id === body.serviceId && s.ownerId === me.id);
    if (!service) return fail(404, 'SERVICE_NOT_FOUND', 'Serviço não encontrado.');
    const days = Math.round((Date.parse(body.toDate) - Date.parse(body.fromDate)) / DAY);
    if (!(days >= 0)) return fail(400, 'VALIDATION_ERROR', 'A data final deve ser igual ou posterior à inicial.');
    if (days + 1 > 90) return fail(400, 'BATCH_TOO_LONG', 'O período máximo é de 90 dias.');
    if (body.startTime >= body.endTime) return fail(400, 'VALIDATION_ERROR', 'O horário inicial deve ser anterior ao final.');
    const clinicId = service.modality === 'IN_PERSON' ? body.clinicId ?? null : null;
    const created: Json[] = [];
    for (let i = 0; i <= days; i++) {
      const day = new Date(Date.parse(`${body.fromDate}T12:00:00Z`) + i * DAY);
      if (!body.weekdays.includes(day.getUTCDay())) continue;
      const dayIso = day.toISOString().slice(0, 10);
      const start = new Date(`${dayIso}T${body.startTime}:00-03:00`).getTime();
      const end = new Date(`${dayIso}T${body.endTime}:00-03:00`).getTime();
      const step = service.durationMinutes * 60000;
      for (let t = start; t + step <= end; t += step) {
        created.push({ id: uid(), professionalId: provider!.id, serviceId: service.id, clinicId, startsAt: new Date(t).toISOString(), endsAt: new Date(t + step).toISOString(), status: 'AVAILABLE' });
      }
    }
    if (created.length === 0) return fail(400, 'NO_SLOTS_GENERATED', 'Nenhum horário cabe nesse período.');
    if (new Date(created[0].startsAt) <= new Date()) return fail(400, 'SLOT_IN_PAST', 'O lote contém horários que já passaram.');
    const clash = created.find((c) => state.slots.some((s) => s.professionalId === provider!.id && s.startsAt < c.endsAt && s.endsAt > c.startsAt));
    if (clash) return fail(409, 'SLOT_OVERLAP', 'Já existe um horário seu que se sobrepõe a esse intervalo.');
    state.slots.push(...created);
    return ok({ created: created.length }, 201);
  }

  // verificação
  const scopeFor = (target: string, clinicId?: string) => {
    if (target === 'CLINIC') {
      const c = clinicId ? owned(clinicId) : undefined;
      return c ? { entity: c as Json, match: (d: Json) => d.clinicId === c.id } : null;
    }
    return provider ? { entity: provider as Json, match: (d: Json) => d.professionalId === provider.id } : null;
  };
  if (method === 'GET' && at('verification', 'documents')) {
    const scope = scopeFor(q.get('target') ?? '', q.get('clinicId') ?? undefined);
    if (!scope) return fail(404, 'NOT_FOUND', 'Cadastro não encontrado.');
    return ok(state.documents.filter(scope.match));
  }
  if (method === 'POST' && at('verification', 'documents')) {
    const scope = scopeFor(body.target, body.clinicId);
    if (!scope) return fail(404, 'NOT_FOUND', 'Cadastro não encontrado.');
    const file = body.file as File | undefined;
    if (!file) return fail(400, 'FILE_REQUIRED', 'Envie um arquivo.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return fail(400, 'FILE_TYPE_NOT_ALLOWED', 'Envie PDF, JPEG ou PNG.');
    if (file.size > 10 * 1024 * 1024) return fail(413, 'FILE_TOO_LARGE', 'O arquivo passa de 10 MB.');
    if (state.documents.filter(scope.match).length >= 10) return fail(409, 'DOCUMENT_LIMIT_REACHED', 'Limite de documentos atingido. Remova algum antes de enviar outro.');
    const doc = { id: uid(), professionalId: body.target === 'PROFESSIONAL' ? scope.entity.id : null, clinicId: body.target === 'CLINIC' ? scope.entity.id : null, kind: body.kind, originalName: file.name, mimeType: file.type, sizeBytes: file.size, createdAt: new Date().toISOString() };
    state.documents.push(doc);
    return ok(doc, 201);
  }
  if (method === 'DELETE' && at('verification', 'documents', '*')) {
    const doc = state.documents.find((d) => d.id === seg[2] && ((provider && d.professionalId === provider.id) || (d.clinicId && owned(d.clinicId))));
    if (!doc) return fail(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    state.documents = state.documents.filter((d) => d.id !== doc.id);
    return { status: 204 };
  }
  if (method === 'POST' && at('verification', 'requests')) {
    const scope = scopeFor(body.target, body.clinicId);
    if (!scope) return fail(404, 'NOT_FOUND', 'Cadastro não encontrado.');
    const e = scope.entity;
    if (e.verificationStatus === 'APPROVED') return fail(409, 'ALREADY_APPROVED', 'Este perfil já está aprovado.');
    if (e.verificationStatus === 'SUSPENDED') return fail(409, 'PROFILE_SUSPENDED', 'Perfil suspenso. Fale com o suporte.');
    const key = body.target === 'CLINIC' ? 'clinicId' : 'professionalId';
    if (state.requests.some((r) => r[key] === e.id && r.status === 'PENDING')) return fail(409, 'VERIFICATION_ALREADY_PENDING', 'Já existe uma solicitação em análise.');
    const missing = missingFor(body.target, e);
    if (missing.length) return fail(409, 'VERIFICATION_INCOMPLETE', 'Complete o cadastro antes de enviar para análise.', { missing });
    const r = { id: uid(), target: body.target, professionalId: key === 'professionalId' ? e.id : null, clinicId: key === 'clinicId' ? e.id : null, status: 'PENDING', reason: null, decidedAt: null, decidedById: null, createdAt: new Date().toISOString() };
    state.requests.push(r);
    e.verificationStatus = 'PENDING';
    return ok(r, 201);
  }
  if (method === 'GET' && at('verification', 'requests', 'mine')) {
    const clinicIds = state.clinics.filter((c) => c.ownerId === me.id).map((c) => c.id);
    return ok(state.requests.filter((r) => (provider && r.professionalId === provider.id) || (r.clinicId && clinicIds.includes(r.clinicId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  return fail(404, 'NOT_FOUND', 'Recurso não encontrado.');
}

function subjectOf(r: Json) {
  if (r.professionalId) {
    const p = state.professionals.find((x) => x.id === r.professionalId)!;
    return { kind: 'PROFESSIONAL', name: p.displayName, crmv: `${p.crmvNumber}/${p.crmvState}`, city: p.city, verificationStatus: p.verificationStatus };
  }
  const c = state.clinics.find((x) => x.id === r.clinicId)!;
  return { kind: 'CLINIC', name: c.name, city: c.city, state: c.state, responsibleVet: c.responsibleVet, responsibleCrmv: c.responsibleCrmv, verificationStatus: c.verificationStatus };
}

function adminArea(method: string, seg: string[], at: (...p: string[]) => boolean, q: URLSearchParams, body: Json, me: User, limit: number): Result {
  const ownerOf = (r: Json) => (r.professionalId ? state.professionals.find((p) => p.id === r.professionalId)?.userId : state.clinics.find((c) => c.id === r.clinicId)?.ownerId) ?? null;

  if (method === 'GET' && at('admin', 'verification-requests')) {
    const status = q.get('status') ?? 'PENDING';
    const list = state.requests.filter((r) => r.status === status).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return page(list.map((r) => ({ ...r, subject: subjectOf(r) })), 1, limit);
  }
  if (at('admin', 'verification-requests', '*')) {
    const r = state.requests.find((x) => x.id === seg[2]);
    if (!r) return fail(404, 'VERIFICATION_REQUEST_NOT_FOUND', 'Pedido não encontrado.');
    const entity = r.professionalId ? state.professionals.find((p) => p.id === r.professionalId) : state.clinics.find((c) => c.id === r.clinicId);
    const documents = state.documents.filter((d) => (r.professionalId ? d.professionalId === r.professionalId : d.clinicId === r.clinicId));
    return ok({ ...r, subject: subjectOf(r), documents, missing: missingFor(r.target, entity!) });
  }
  if (method === 'POST' && at('admin', 'verification-requests', '*', 'documents', '*', 'link')) {
    const doc = state.documents.find((d) => d.id === seg[4]);
    if (!doc) return fail(404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    audit(me.id, 'VERIFICATION_DOCUMENT_VIEWED', 'VerificationRequest', seg[2], { documentId: doc.id });
    const html = `<!doctype html><meta charset="utf-8"><title>${doc.originalName}</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#f7f4ee"><div style="text-align:center"><h2>${doc.originalName}</h2><p>Na demonstração os arquivos não são guardados.<br>No app real, este link abre o documento por 2 minutos.</p></div>`;
    return ok({ url: URL.createObjectURL(new Blob([html], { type: 'text/html' })), expiresInSeconds: 120 }, 201);
  }
  if (method === 'POST' && at('admin', 'verification-requests', '*', 'decision')) {
    const r = state.requests.find((x) => x.id === seg[2]);
    if (!r) return fail(404, 'VERIFICATION_REQUEST_NOT_FOUND', 'Pedido não encontrado.');
    if (r.status !== 'PENDING') return fail(409, 'REQUEST_ALREADY_DECIDED', 'Este pedido já foi decidido.');
    if (body.decision !== 'APPROVE' && !(body.reason?.length >= 5)) return fail(400, 'REASON_REQUIRED', 'Informe a justificativa da decisão (mínimo 5 caracteres).');
    const entity = (r.professionalId ? state.professionals.find((p) => p.id === r.professionalId) : state.clinics.find((c) => c.id === r.clinicId)) as Json;
    if (body.decision === 'APPROVE' && missingFor(r.target, entity).length) return fail(409, 'VERIFICATION_INCOMPLETE', 'O cadastro ainda está incompleto.', { missing: missingFor(r.target, entity) });
    const outcome = body.decision === 'APPROVE' ? 'APPROVED' : body.decision === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';
    Object.assign(r, { status: outcome, reason: body.reason ?? null, decidedAt: new Date().toISOString(), decidedById: me.id });
    entity.verificationStatus = outcome;
    audit(me.id, `VERIFICATION_${outcome}`, 'VerificationRequest', r.id, { reason: body.reason ?? null, name: subjectOf(r).name });
    notify(ownerOf(r), 'VERIFICATION_DECIDED', outcome === 'APPROVED' ? 'Cadastro aprovado' : outcome === 'REJECTED' ? 'Cadastro recusado' : 'Correção pedida',
      outcome === 'APPROVED' ? `${subjectOf(r).name} já aparece para os tutores.` : `${subjectOf(r).name}: ${body.reason}`);
    return ok(r);
  }

  if (method === 'POST' && at('admin', '*', '*', '*') && (seg[1] === 'clinics' || seg[1] === 'professionals')) {
    const list = (seg[1] === 'clinics' ? state.clinics : state.professionals) as Json[];
    const entity = list.find((x) => x.id === seg[2]);
    if (!entity) return fail(404, 'PROVIDER_NOT_FOUND', 'Cadastro não encontrado.');
    if (!(body.reason?.length >= 5)) return fail(400, 'VALIDATION_ERROR', 'Informe o motivo (mínimo 5 caracteres).');
    const suspend = seg[3] === 'suspend';
    if (suspend ? entity.verificationStatus !== 'APPROVED' : entity.verificationStatus !== 'SUSPENDED') return fail(409, 'INVALID_STATE', 'O estado atual do cadastro não permite essa operação.');
    entity.verificationStatus = suspend ? 'SUSPENDED' : 'APPROVED';
    const name = entity.displayName ?? entity.name;
    audit(me.id, suspend ? 'PROVIDER_SUSPENDED' : 'PROVIDER_REINSTATED', seg[1] === 'clinics' ? 'Clinic' : 'Professional', entity.id, { reason: body.reason, name });
    notify(entity.userId ?? entity.ownerId, 'VERIFICATION_DECIDED', suspend ? 'Cadastro suspenso' : 'Cadastro reativado', `${name}: ${body.reason}`);
    return ok({ id: entity.id, verificationStatus: entity.verificationStatus });
  }

  if (method === 'GET' && at('admin', 'audit-logs')) return page(state.audit, 1, limit);

  if (method === 'GET' && at('admin', 'campaigns')) {
    const status = q.get('status');
    return page(state.campaigns.filter((c) => !status || c.status === status).sort((a, b) => b.startsAt.localeCompare(a.startsAt)), 1, limit);
  }
  if (method === 'POST' && at('admin', 'campaigns')) {
    for (const k of ['title', 'type', 'organization', 'audience', 'requirements', 'location', 'startsAt', 'endsAt', 'sourceUrl']) if (!body[k]) return fail(400, 'VALIDATION_ERROR', `Preencha o campo ${k}.`);
    if (!/^https:\/\/[^/\s]+\.[^/\s]+/.test(body.sourceUrl)) return fail(400, 'VALIDATION_ERROR', 'A fonte precisa ser um endereço https público.');
    if (new Date(body.endsAt) <= new Date(body.startsAt)) return fail(400, 'VALIDATION_ERROR', 'O fim deve ser depois do início.');
    const c: Json = { id: uid(), ...body, startsAt: new Date(body.startsAt).toISOString(), endsAt: new Date(body.endsAt).toISOString(), sourceStatus: 'NOT_CHECKED', status: 'DRAFT', verifiedAt: null };
    state.campaigns.push(c);
    audit(me.id, 'CAMPAIGN_CREATED', 'Campaign', c.id, { name: c.title });
    return ok(c, 201);
  }
  if (method === 'POST' && at('admin', 'campaigns', '*', '*')) {
    const c = state.campaigns.find((x) => x.id === seg[2]);
    if (!c) return fail(404, 'CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
    const rules: Record<string, [string[], string, string]> = {
      submit: [['DRAFT'], 'UNDER_REVIEW', 'CAMPAIGN_SUBMITTED'],
      publish: [['UNDER_REVIEW'], 'PUBLISHED', 'CAMPAIGN_PUBLISHED'],
      archive: [['DRAFT', 'UNDER_REVIEW', 'PUBLISHED', 'ENDED'], 'ARCHIVED', 'CAMPAIGN_ARCHIVED'],
    };
    const rule = rules[seg[3]];
    if (!rule) return fail(404, 'NOT_FOUND', 'Recurso não encontrado.');
    if (!rule[0].includes(c.status)) return fail(409, 'INVALID_STATE', 'O estado atual da campanha não permite essa operação.');
    if (seg[3] === 'publish' && new Date(c.endsAt) <= new Date()) return fail(409, 'CAMPAIGN_PERIOD_ENDED', 'O período da campanha já terminou.');
    c.status = rule[1];
    if (seg[3] === 'publish') { c.verifiedAt = new Date().toISOString(); c.sourceStatus = 'VALID'; }
    audit(me.id, rule[2], 'Campaign', c.id, { name: c.title });
    return ok(c);
  }

  return fail(404, 'NOT_FOUND', 'Recurso não encontrado.');
}
