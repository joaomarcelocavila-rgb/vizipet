import {
  TestContext,
  createBookableProvider,
  createSlot,
  createSpecies,
  createTestApp,
  resetDatabase,
} from './helpers';

describe('P4/P6 busca', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetDatabase(ctx.prisma));

  const search = (query: string) => ctx.http().get(`/api/v1/search/professionals?${query}`);

  it('encontra com e sem acento e não expõe dados administrativos', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    await createBookableProvider(ctx.prisma, { speciesIds: [dog.id], name: 'Dra. Ana Lúcia' });

    for (const q of ['lucia', 'LÚCIA', 'dermato', 'consulta dermatologica']) {
      const res = await search(`q=${encodeURIComponent(q)}`).expect(200);
      expect(res.body.meta.total).toBe(1);
    }
    const item = (await search('q=ana').expect(200)).body.data[0];
    expect(item.nextAvailableAt).toBeTruthy();
    expect(item.services[0].name).toBe('Consulta dermatológica');
    expect(JSON.stringify(item)).not.toMatch(/userId|verificationStatus|storage|latitude/);
  });

  it('perfil pendente ou suspenso não aparece; conta bloqueada também não', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    const a = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    const b = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    const c = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    await ctx.prisma.professional.update({ where: { id: a.professional.id }, data: { verificationStatus: 'PENDING' } });
    await ctx.prisma.professional.update({
      where: { id: b.professional.id },
      data: { verificationStatus: 'SUSPENDED' },
    });
    await ctx.prisma.user.update({ where: { id: c.user.id }, data: { status: 'BLOCKED' } });

    expect((await search('').expect(200)).body.meta.total).toBe(0);
    await ctx.http().get(`/api/v1/search/professionals/${a.professional.id}`).expect(404);
  });

  it('combina filtros de modalidade, espécie, cidade e data', async () => {
    const { dog, cat } = await createSpecies(ctx.prisma);
    const recife = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id], city: 'Recife' });
    await createBookableProvider(ctx.prisma, { speciesIds: [cat.id], city: 'Olinda' });

    expect((await search(`speciesId=${dog.id}`).expect(200)).body.data.map((p: any) => p.id)).toEqual([
      recife.professional.id,
    ]);
    expect((await search('city=olinda&modality=REMOTE').expect(200)).body.meta.total).toBe(0);
    expect((await search('city=olinda&modality=IN_PERSON').expect(200)).body.meta.total).toBe(1);

    const slotDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(recife.slot.startsAt);
    expect((await search(`date=${slotDay}&speciesId=${dog.id}`).expect(200)).body.meta.total).toBe(1);
    expect((await search('date=2020-01-01').expect(200)).body.meta.total).toBe(0);
  });

  it('horário ocupado não conta como próxima disponibilidade', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    const p = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    const later = await createSlot(ctx.prisma, p.professional.id, p.service.id, p.clinic.id, 50);
    await ctx.prisma.availabilitySlot.update({ where: { id: p.slot.id }, data: { status: 'BOOKED' } });

    const item = (await search('').expect(200)).body.data[0];
    expect(new Date(item.nextAvailableAt).getTime()).toBe(later.startsAt.getTime());
  });

  it('distância só é calculada quando os dois lados têm coordenadas', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    const near = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    await ctx.prisma.professional.update({
      where: { id: near.professional.id },
      data: { latitude: -8.12, longitude: -34.9 },
    });

    const res = await search('lat=-8.05&lng=-34.88&sort=distance').expect(200);
    expect(res.body.data[0].id).toBe(near.professional.id);
    expect(res.body.data[0].distanceKm).toBeGreaterThan(0);
    expect(res.body.data[1].distanceKm).toBeUndefined();

    await search('sort=distance').expect(400);
  });

  it('emergência lista só clínicas 24 h aprovadas, da mais próxima para a mais longe', async () => {
    const clinic = (name: string, extra: Record<string, unknown>) =>
      ctx.prisma.clinic.create({
        data: {
          name,
          addressLine: 'Rua A, 10',
          neighborhood: 'Centro',
          city: 'Recife',
          state: 'PE',
          verificationStatus: 'APPROVED',
          publicProfile: { name },
          ...extra,
        },
      });
    await clinic('Plantão Longe', { emergency24h: true, latitude: -8.2, longitude: -34.95 });
    await clinic('Plantão Perto', { emergency24h: true, latitude: -8.06, longitude: -34.89 });
    await clinic('Plantão Sem Mapa', { emergency24h: true });
    await clinic('Clínica Comum', { latitude: -8.05, longitude: -34.88 });
    await clinic('Plantão Pendente', { emergency24h: true, verificationStatus: 'PENDING' });

    const res = await ctx.http().get('/api/v1/search/clinics?emergency=true&lat=-8.05&lng=-34.88').expect(200);
    expect(res.body.data.map((c: { name: string }) => c.name)).toEqual([
      'Plantão Perto',
      'Plantão Longe',
      'Plantão Sem Mapa',
    ]);
    expect(res.body.data[0].distanceKm).toBeLessThan(res.body.data[1].distanceKm);
    expect(res.body.data[2].distanceKm).toBeUndefined();

    const all = await ctx.http().get('/api/v1/search/clinics').expect(200);
    expect(all.body.meta.total).toBe(4);
    await ctx.http().get('/api/v1/search/clinics?lat=-8.05').expect(400);
    await ctx.http().get('/api/v1/search/clinics?emergency=talvez').expect(400);
  });

  it('pagina de forma estável, com limite máximo e sem paginação profunda', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    for (let i = 0; i < 5; i++)
      await createBookableProvider(ctx.prisma, { speciesIds: [dog.id], name: `Profissional ${i}` });

    const page1 = (await search('limit=2&page=1&sort=name').expect(200)).body;
    const page2 = (await search('limit=2&page=2&sort=name').expect(200)).body;
    expect(page1.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page1.data.map((p: any) => p.id)).not.toContain(page2.data[0].id);

    await search('limit=51').expect(400);
    expect((await search('limit=50&page=21').expect(400)).body.code).toBe('PAGE_TOO_DEEP');
  });

  it('busca com mil profissionais responde rápido', async () => {
    const { dog } = await createSpecies(ctx.prisma);
    const base = await createBookableProvider(ctx.prisma, { speciesIds: [dog.id] });
    await ctx.prisma.$executeRaw`
      INSERT INTO users (id, email, password_hash, name, role, status, updated_at)
      SELECT gen_random_uuid(), 'massa' || g || '@teste.dev', 'x', 'Massa ' || g, 'PROFESSIONAL', 'ACTIVE', now()
        FROM generate_series(1, 1000) g`;
    await ctx.prisma.$executeRaw`
      INSERT INTO professionals (id, user_id, display_name, crmv_number, crmv_state, city, neighborhood, verification_status, public_profile, updated_at)
      SELECT gen_random_uuid(), u.id, u.name, (100000 + row_number() OVER ())::text, 'SP',
             CASE WHEN random() < 0.5 THEN 'Recife' ELSE 'São Paulo' END, 'Centro', 'APPROVED', jsonb_build_object('name', u.name), now()
        FROM users u WHERE u.email LIKE 'massa%'`;
    await ctx.prisma.$executeRaw`
      INSERT INTO service_professionals (service_id, professional_id)
      SELECT ${base.service.id}::uuid, id FROM professionals WHERE crmv_state = 'SP'`;

    const started = Date.now();
    const res = await search(`q=massa&city=sao%20paulo&modality=IN_PERSON&speciesId=${dog.id}&limit=50`).expect(200);
    expect(res.body.data).toHaveLength(50);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
