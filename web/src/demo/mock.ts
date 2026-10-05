/**
 * Back end simulado no navegador, usado só no build de demonstração (VITE_DEMO=1).
 * Reproduz as respostas e as regras principais da API real com os dados do seed.
 */
type Json = Record<string, any>;
interface Result { status: number; body?: Json }

const KEY = 'vizipet.demo.v2';
const HOUR = 3600_000;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now().toString(16));
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const recifeDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Recife' });
// Recife é UTC−3 o ano todo.
const atRecife = (daysAhead: number, hh: number, mm = 0) => {
  const base = new Date(`${recifeDay(new Date(Date.now() + daysAhead * 86400000))}T00:00:00-03:00`);
  return new Date(base.getTime() + (hh * 60 + mm) * 60000);
};

function seed() {
  const dog = { id: 'sp-dog', name: 'Cachorro' };
  const cat = { id: 'sp-cat', name: 'Gato' };
  const users = [
    { id: 'u-tutor', email: 'tutor@vizipet.test', name: 'Marina Tutora', role: 'TUTOR' },
    { id: 'u-carlos', email: 'vet@vizipet.test', name: 'Dr. Carlos Veterinário', role: 'PROFESSIONAL' },
    { id: 'u-lucia', email: 'dermato@vizipet.test', name: 'Dra. Lúcia Andrade', role: 'PROFESSIONAL' },
    { id: 'u-rafael', email: 'felinos@vizipet.test', name: 'Dr. Rafael Moura', role: 'PROFESSIONAL' },
    { id: 'u-admin', email: 'admin@vizipet.test', name: 'Admin Vizipet', role: 'ADMIN' },
  ];
  const providers = [
    {
      id: 'p-carlos', userId: 'u-carlos', name: 'Dr. Carlos Veterinário', specialty: 'Clínica geral', crmv: '12345/PE',
      bio: 'Atendimento clínico de cães e gatos.', city: 'Recife', neighborhood: 'Boa Viagem',
      clinic: { id: 'c-patafeliz', name: 'Clínica Pata Feliz', address: 'Av. Conselheiro Aguiar, 1000, Boa Viagem, Recife/PE' },
      services: [{ id: 's-consulta', name: 'Consulta clínica', modality: 'IN_PERSON', durationMinutes: 30, priceCents: 15000, species: [dog, cat] }],
      plan: [[2, 9, 6]],
    },
    {
      id: 'p-lucia', userId: 'u-lucia', name: 'Dra. Lúcia Andrade', specialty: 'Dermatologia', crmv: '23456/PE',
      bio: 'Alergias, otites e problemas de pele em cães e gatos.', city: 'Recife', neighborhood: 'Graças',
      clinic: { id: 'c-derma', name: 'Derma Pet Graças', address: 'Rua das Graças, 210, Graças, Recife/PE' },
      services: [{ id: 's-derma', name: 'Consulta dermatológica', modality: 'IN_PERSON', durationMinutes: 40, priceCents: 22000, species: [dog, cat] }],
      plan: [[1, 14, 4], [3, 14, 4], [4, 14, 4]],
    },
    {
      id: 'p-rafael', userId: 'u-rafael', name: 'Dr. Rafael Moura', specialty: 'Medicina felina', crmv: '34567/PE',
      bio: 'Atendimento exclusivo para gatos, também por vídeo.', city: 'Olinda', neighborhood: 'Casa Caiada',
      clinic: null,
      services: [{ id: 's-tele', name: 'Teleorientação felina', modality: 'REMOTE', durationMinutes: 20, priceCents: 9000, species: [cat] }],
      plan: [[1, 14, 4], [2, 14, 4], [5, 14, 4]],
    },
  ];
  const slots: Json[] = [];
  for (const p of providers) {
    const s = p.services[0];
    for (const [days, hour, count] of p.plan) {
      for (let i = 0; i < count; i++) {
        const startsAt = new Date(atRecife(days, hour).getTime() + i * s.durationMinutes * 60000);
        slots.push({ id: uid(), professionalId: p.id, serviceId: s.id, clinicId: p.clinic?.id ?? null, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + s.durationMinutes * 60000).toISOString(), status: 'AVAILABLE' });
      }
    }
  }
  const now = Date.now();
  return {
    createdAt: now,
    species: [dog, cat],
    users,
    providers,
    pets: [
      { id: 'pet-luna', ownerId: 'u-tutor', name: 'Luna', species: dog },
      { id: 'pet-mingau', ownerId: 'u-tutor', name: 'Mingau', species: cat },
    ],
    slots,
    appointments: [] as Json[],
    notifications: [] as Json[],
    idempotency: {} as Record<string, { hash: string; appointmentId: string }>,
    requests: [
      { id: 'vr-paula', target: 'PROFESSIONAL', status: 'PENDING', createdAt: new Date(now - 5 * HOUR).toISOString(), subject: { kind: 'PROFESSIONAL', name: 'Dra. Paula Nunes', crmv: '45678/PE', city: 'Jaboatão dos Guararapes' } },
    ],
    campaigns: [
      { id: 'cp-raiva', title: 'Vacinação antirrábica gratuita', type: 'VACINACAO', organization: 'Prefeitura do Recife', audience: 'Cães e gatos a partir de 3 meses', requirements: 'Levar o animal com coleira ou caixa de transporte', location: 'Postos de vacinação em todos os distritos sanitários', startsAt: new Date(now - 2 * 86400000).toISOString(), endsAt: new Date(now + 20 * 86400000).toISOString(), sourceUrl: 'https://www2.recife.pe.gov.br/', sourceStatus: 'VALID', status: 'PUBLISHED', verifiedAt: new Date(now - 86400000).toISOString() },
      { id: 'cp-castra', title: 'Castração solidária', type: 'CASTRACAO', organization: 'Governo de Pernambuco', audience: 'Tutores inscritos no CadÚnico', requirements: 'Agendamento prévio e jejum de 8 horas', location: 'Hospital Veterinário Público', startsAt: new Date(now - 86400000).toISOString(), endsAt: new Date(now + 40 * 86400000).toISOString(), sourceUrl: 'https://www.pe.gov.br/', sourceStatus: 'VALID', status: 'PUBLISHED', verifiedAt: new Date(now - 86400000).toISOString() },
    ],
  };
}

type State = ReturnType<typeof seed>;
let state: State = load();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      // Os horários são relativos a hoje; depois de um dia a demonstração recomeça.
      if (Date.now() - parsed.createdAt < 86400000) return parsed;
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
const fail = (status: number, code: string, message: string): Result => ({ status, body: { statusCode: status, code, message, requestId: uid() } });

function currentUser(token: string | null) {
  const id = token?.startsWith('demo:') ? token.slice(5) : null;
  return state.users.find((u) => u.id === id) ?? null;
}

const nextSlot = (providerId: string, filter: (s: Json) => boolean = () => true) =>
  state.slots
    .filter((s) => s.professionalId === providerId && s.status === 'AVAILABLE' && new Date(s.startsAt) > new Date() && filter(s))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]?.startsAt ?? null;

function publicProvider(p: State['providers'][number]) {
  return {
    id: p.id, name: p.name, specialty: p.specialty, bio: p.bio, crmv: p.crmv, city: p.city, neighborhood: p.neighborhood,
    services: p.services, clinics: p.clinic ? [p.clinic] : [], nextAvailableAt: nextSlot(p.id),
  };
}

function notify(userId: string, type: string, title: string, body: string) {
  state.notifications.unshift({ id: uid(), userId, type, title, body, readAt: null, createdAt: new Date().toISOString() });
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'long', timeStyle: 'short' }).replace(',', ' às');

export async function demoRequest(method: string, fullPath: string, body: Json | undefined, headers: Record<string, string>, token: string | null): Promise<Result> {
  await new Promise((r) => setTimeout(r, 120));
  const [path, qs] = fullPath.split('?');
  const q = new URLSearchParams(qs ?? '');
  const seg = path.split('/').filter(Boolean);
  const me = currentUser(token);
  const result = route(method, seg, q, body ?? {}, headers, me);
  if (method !== 'GET') save();
  return result;
}

function route(method: string, seg: string[], q: URLSearchParams, body: Json, headers: Record<string, string>, me: State['users'][number] | null): Result {
  const at = (...parts: string[]) => parts.length === seg.length && parts.every((p, i) => p === '*' || p === seg[i]);

  // públicas
  if (method === 'GET' && at('dev', 'users')) return ok(state.users.map(({ email, name, role }) => ({ email, name, role })));
  if (method === 'POST' && at('dev', 'login')) {
    const user = state.users.find((u) => u.email === body.email);
    if (!user) return fail(404, 'USER_NOT_FOUND', 'Usuário de teste não encontrado.');
    return ok({ accessToken: `demo:${user.id}`, user: { id: user.id, name: user.name, role: user.role } }, 201);
  }
  if (method === 'GET' && at('species')) return ok(state.species);
  if (method === 'GET' && at('campaigns')) {
    const now = new Date().toISOString();
    const list = state.campaigns.filter((c) => c.status === 'PUBLISHED' && c.startsAt <= now && c.endsAt >= now);
    return page(list, 1, Number(q.get('limit') ?? 20));
  }
  if (method === 'GET' && at('search', 'professionals')) return search(q);
  if (method === 'GET' && at('search', 'professionals', '*')) {
    const p = state.providers.find((x) => x.id === seg[2]);
    return p ? ok(publicProvider(p)) : fail(404, 'PROFESSIONAL_NOT_FOUND', 'Profissional não encontrado.');
  }
  if (method === 'GET' && at('search', 'professionals', '*', 'slots')) {
    const serviceId = q.get('serviceId');
    const list = state.slots
      .filter((s) => s.professionalId === seg[2] && s.status === 'AVAILABLE' && new Date(s.startsAt) > new Date() && (!serviceId || s.serviceId === serviceId))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return ok(list.map(({ id, serviceId: sid, clinicId, startsAt, endsAt }) => ({ id, serviceId: sid, clinicId, startsAt, endsAt })));
  }

  if (!me) return fail(401, 'UNAUTHORIZED', 'Autenticação ausente ou expirada.');
  const denied = fail(403, 'ACCESS_DENIED', 'Você não tem permissão para esta operação.');
  const provider = state.providers.find((p) => p.userId === me.id);

  // notificações
  if (at('notifications')) {
    const mine = state.notifications.filter((n) => n.userId === me.id);
    return page(mine, 1, Number(q.get('limit') ?? 20), { unread: mine.filter((n) => !n.readAt).length });
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

  // agendamentos
  if (method === 'POST' && at('appointments')) {
    if (me.role !== 'TUTOR') return denied;
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
    const p = state.providers.find((x) => x.id === body.professionalId);
    const service = p?.services.find((s) => s.id === body.serviceId);
    if (!p || !service) return fail(409, 'SERVICE_NOT_AVAILABLE', 'Este serviço não está disponível.');
    if (!service.species.some((s) => s.id === pet.species.id)) return fail(409, 'SERVICE_NOT_AVAILABLE', 'Este serviço não atende a espécie do pet.');
    const slot = state.slots.find((s) => s.id === body.slotId && s.professionalId === p.id && s.serviceId === service.id);
    if (!slot || slot.status !== 'AVAILABLE' || new Date(slot.startsAt) <= new Date()) {
      return fail(409, 'SLOT_NOT_AVAILABLE', 'Este horário não está mais disponível.');
    }
    slot.status = 'BOOKED';
    const appointment = {
      id: uid(), status: 'CONFIRMED', startsAt: slot.startsAt, endsAt: slot.endsAt, slotId: slot.id, tutorId: me.id, professionalId: p.id,
      cancelReason: null, createdAt: new Date().toISOString(),
      snapshot: {
        serviceName: service.name, durationMinutes: service.durationMinutes, modality: service.modality, priceCents: service.priceCents,
        professionalName: p.name, clinicName: p.clinic?.name ?? null, clinicAddress: p.clinic?.address ?? null, petName: pet.name, tutorName: me.name,
      },
    };
    state.appointments.push(appointment);
    state.idempotency[`${me.id}:${key}`] = { hash, appointmentId: appointment.id };
    notify(me.id, 'APPOINTMENT_CONFIRMED', 'Consulta confirmada', `${service.name} de ${pet.name} com ${p.name} em ${when(slot.startsAt)}.`);
    notify(p.userId, 'APPOINTMENT_CONFIRMED', 'Nova consulta agendada', `${service.name} com ${pet.name} (tutor: ${me.name}) em ${when(slot.startsAt)}.`);
    return ok(appointment, 201);
  }

  const visible = (a: Json) => (me.role === 'TUTOR' ? a.tutorId === me.id : a.professionalId === provider?.id);

  if (method === 'GET' && at('appointments')) {
    if (me.role === 'ADMIN') return denied;
    const now = new Date().toISOString();
    const scope = q.get('scope') ?? 'upcoming';
    let list = state.appointments.filter(visible);
    if (scope === 'upcoming') list = list.filter((a) => a.status === 'CONFIRMED' && a.endsAt > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    else if (scope === 'past') list = list.filter((a) => a.status === 'COMPLETED' || (a.status === 'CONFIRMED' && a.endsAt <= now)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    else list = list.filter((a) => a.status.startsWith('CANCELLED')).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return page(list);
  }

  if (method === 'POST' && at('appointments', '*', 'cancel')) {
    const a = state.appointments.find((x) => x.id === seg[1] && visible(x));
    if (!a) return fail(404, 'APPOINTMENT_NOT_FOUND', 'Agendamento não encontrado.');
    const byProvider = me.role === 'PROFESSIONAL';
    if (byProvider && !body.reason) return fail(400, 'VALIDATION_ERROR', 'Informe o motivo do cancelamento.');
    if (a.status.startsWith('CANCELLED')) return fail(409, 'APPOINTMENT_ALREADY_CANCELLED', 'Este agendamento já foi cancelado.');
    if (new Date(a.startsAt) <= new Date()) return fail(409, 'APPOINTMENT_ALREADY_STARTED', 'A consulta já começou e não pode ser cancelada.');
    a.status = byProvider ? 'CANCELLED_BY_PROVIDER' : 'CANCELLED_BY_TUTOR';
    a.cancelReason = body.reason ?? null;
    const slot = state.slots.find((s) => s.id === a.slotId);
    if (slot && slot.status === 'BOOKED') slot.status = 'AVAILABLE';
    const other = byProvider ? a.tutorId : state.providers.find((p) => p.id === a.professionalId)!.userId;
    notify(other, 'APPOINTMENT_CANCELLED', 'Consulta cancelada',
      `${a.snapshot.serviceName} marcado para ${when(a.startsAt)} foi cancelado ${byProvider ? 'pelo profissional' : 'pelo tutor'}.${a.cancelReason ? ` Motivo: ${a.cancelReason}` : ''}`);
    return ok(a);
  }

  // horários do profissional
  if (method === 'GET' && at('services', 'mine')) {
    if (!provider) return denied;
    return ok(provider.services.map((s) => ({ ...s, active: true })));
  }
  if (method === 'GET' && at('clinics', 'mine')) {
    if (!provider) return denied;
    return ok(provider.clinic ? [provider.clinic] : []);
  }
  if (method === 'GET' && at('availability', 'mine')) {
    if (!provider) return denied;
    const list = state.slots
      .filter((s) => s.professionalId === provider.id && new Date(s.startsAt) > new Date(Date.now() - 12 * HOUR))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return page(list, 1, Number(q.get('limit') ?? 50));
  }
  if (method === 'PATCH' && at('availability', '*', '*')) {
    const slot = provider && state.slots.find((s) => s.id === seg[1] && s.professionalId === provider.id);
    if (!slot) return fail(404, 'SLOT_NOT_FOUND', 'Horário não encontrado.');
    const [from, to] = seg[2] === 'block' ? ['AVAILABLE', 'BLOCKED'] : ['BLOCKED', 'AVAILABLE'];
    if (slot.status !== from) return fail(409, 'SLOT_NOT_AVAILABLE', 'O estado atual do horário não permite essa operação.');
    slot.status = to;
    return ok(slot);
  }
  if (method === 'POST' && at('availability', 'batch')) {
    if (!provider) return denied;
    const service = provider.services.find((s) => s.id === body.serviceId) ?? provider.services[0];
    const days = Math.round((Date.parse(body.toDate) - Date.parse(body.fromDate)) / 86400000);
    if (!(days >= 0)) return fail(400, 'VALIDATION_ERROR', 'A data final deve ser igual ou posterior à inicial.');
    if (days + 1 > 90) return fail(400, 'BATCH_TOO_LONG', 'O período máximo é de 90 dias.');
    if (body.startTime >= body.endTime) return fail(400, 'VALIDATION_ERROR', 'O horário inicial deve ser anterior ao final.');
    const created: Json[] = [];
    for (let i = 0; i <= days; i++) {
      const day = new Date(Date.parse(`${body.fromDate}T12:00:00Z`) + i * 86400000);
      if (!body.weekdays.includes(day.getUTCDay())) continue;
      const iso = day.toISOString().slice(0, 10);
      const start = new Date(`${iso}T${body.startTime}:00-03:00`).getTime();
      const end = new Date(`${iso}T${body.endTime}:00-03:00`).getTime();
      for (let t = start; t + service.durationMinutes * 60000 <= end; t += service.durationMinutes * 60000) {
        created.push({ id: uid(), professionalId: provider.id, serviceId: service.id, clinicId: provider.clinic?.id ?? null, startsAt: new Date(t).toISOString(), endsAt: new Date(t + service.durationMinutes * 60000).toISOString(), status: 'AVAILABLE' });
      }
    }
    if (created.length === 0) return fail(400, 'NO_SLOTS_GENERATED', 'Nenhum horário cabe nesse período.');
    if (new Date(created[0].startsAt) <= new Date()) return fail(400, 'SLOT_IN_PAST', 'O lote contém horários que já passaram.');
    const clash = created.find((c) => state.slots.some((s) => s.professionalId === provider.id && s.startsAt < c.endsAt && s.endsAt > c.startsAt));
    if (clash) return fail(409, 'SLOT_OVERLAP', 'Já existe um horário seu que se sobrepõe a esse intervalo.');
    state.slots.push(...created);
    return ok({ created: created.length }, 201);
  }

  // administração
  if (seg[0] === 'admin' && me.role !== 'ADMIN') return denied;
  if (method === 'GET' && at('admin', 'verification-requests')) return page(state.requests.filter((r) => r.status === 'PENDING'));
  if (method === 'POST' && at('admin', 'verification-requests', '*', 'decision')) {
    const r = state.requests.find((x) => x.id === seg[2]);
    if (!r) return fail(404, 'VERIFICATION_REQUEST_NOT_FOUND', 'Pedido não encontrado.');
    if (r.status !== 'PENDING') return fail(409, 'REQUEST_ALREADY_DECIDED', 'Este pedido já foi decidido.');
    if (body.decision !== 'APPROVE' && !body.reason) return fail(400, 'REASON_REQUIRED', 'Informe a justificativa da decisão.');
    r.status = body.decision === 'APPROVE' ? 'APPROVED' : body.decision === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';
    return ok(r);
  }
  if (method === 'GET' && at('admin', 'campaigns')) return page(state.campaigns);

  return fail(404, 'NOT_FOUND', 'Recurso não encontrado.');
}

function search(q: URLSearchParams): Result {
  const text = norm(q.get('q') ?? '');
  const city = norm(q.get('city') ?? '');
  const speciesId = q.get('speciesId');
  const modality = q.get('modality');
  const date = q.get('date');
  const list = state.providers
    .filter((p) => {
      const haystack = norm([p.name, p.specialty, p.city, p.neighborhood, p.clinic?.name ?? '', ...p.services.map((s) => s.name)].join(' '));
      if (text && !haystack.includes(text)) return false;
      if (city && !norm(p.city).includes(city)) return false;
      const services = p.services.filter((s) => (!modality || s.modality === modality) && (!speciesId || s.species.some((x) => x.id === speciesId)));
      if ((modality || speciesId) && services.length === 0) return false;
      if (date && !nextSlot(p.id, (s) => recifeDay(new Date(s.startsAt)) === date && services.some((x) => x.id === s.serviceId))) return false;
      return true;
    })
    .map(publicProvider)
    .sort((a, b) => (a.nextAvailableAt ?? '9').localeCompare(b.nextAvailableAt ?? '9') || a.name.localeCompare(b.name));
  return page(list);
}
