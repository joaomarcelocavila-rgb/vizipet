import { TestContext, auth, createTestApp, createUser, iso, resetDatabase } from './helpers';

describe('G1 campanhas', () => {
  let ctx: TestContext;
  let admin: { id: string; role: string };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    admin = await createUser(ctx.prisma, 'ADMIN');
  });

  const valid = () => ({
    title: 'Vacinação antirrábica gratuita',
    type: 'VACINACAO',
    organization: 'Prefeitura do Recife',
    audience: 'Cães e gatos a partir de 3 meses',
    requirements: 'Levar o animal com coleira ou caixa de transporte',
    location: 'Postos de saúde da cidade',
    startsAt: iso(-24),
    endsAt: iso(24 * 10),
    sourceUrl: 'https://www2.recife.pe.gov.br/noticias/vacinacao',
  });

  const create = (body: object) => ctx.http().post('/api/v1/admin/campaigns').set(auth(admin)).send(body);

  async function published() {
    const campaign = (await create(valid()).expect(201)).body.data;
    await ctx.http().post(`/api/v1/admin/campaigns/${campaign.id}/submit`).set(auth(admin)).expect(200);
    return (await ctx.http().post(`/api/v1/admin/campaigns/${campaign.id}/publish`).set(auth(admin)).expect(200)).body
      .data;
  }

  it('rascunho incompleto ou sem fonte é recusado', async () => {
    const { title: _t, ...semTitulo } = valid();
    await create(semTitulo).expect(400);
    const { sourceUrl: _s, ...semFonte } = valid();
    await create(semFonte).expect(400);
  });

  it.each([
    'http://www.recife.pe.gov.br/x',
    'https://localhost/x',
    'https://10.0.0.5/x',
    'https://[::1]/x',
    'https://intranet/x',
    'https://servidor.internal/x',
    'https://user:senha@recife.pe.gov.br/x',
    'javascript:alert(1)',
  ])('recusa fonte insegura ou interna: %s', async (sourceUrl) => {
    const res = await create({ ...valid(), sourceUrl }).expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('nasce DRAFT e só é pública depois de revisada e publicada', async () => {
    const draft = (await create(valid()).expect(201)).body.data;
    expect(draft.status).toBe('DRAFT');
    await ctx.http().get(`/api/v1/campaigns/${draft.id}`).expect(404);
    await ctx.http().post(`/api/v1/admin/campaigns/${draft.id}/publish`).set(auth(admin)).expect(409);

    const campaign = await published();
    expect(campaign).toMatchObject({ status: 'PUBLISHED', verifiedById: admin.id });
    const pub = await ctx.http().get('/api/v1/campaigns').expect(200);
    expect(pub.body.data[0]).toMatchObject({
      id: campaign.id,
      sourceUrl: valid().sourceUrl,
      verifiedAt: expect.any(String),
    });
    expect(pub.body.data[0].verifiedById).toBeUndefined();
    expect(await ctx.prisma.auditLog.count({ where: { entityId: campaign.id } })).toBe(3);
  });

  it('campanha vencida sai da listagem pública e é encerrada pelo job', async () => {
    const campaign = await published();
    await ctx.prisma.campaign.update({ where: { id: campaign.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    expect((await ctx.http().get('/api/v1/campaigns').expect(200)).body.meta.total).toBe(0);
    await ctx.http().get(`/api/v1/campaigns/${campaign.id}`).expect(404);

    await ctx.http().post('/api/v1/internal/jobs/campaigns').set('X-Cron-Secret', 'cron-de-teste').expect(200);
    expect((await ctx.prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).status).toBe('ENDED');
  });

  it('listagem administrativa filtra por status e exige ADMIN', async () => {
    await published();
    await create({ ...valid(), title: 'Castração solidária' }).expect(201);
    expect(
      (await ctx.http().get('/api/v1/admin/campaigns?status=DRAFT').set(auth(admin)).expect(200)).body.meta.total,
    ).toBe(1);
    const tutor = await createUser(ctx.prisma, 'TUTOR');
    await ctx.http().get('/api/v1/admin/campaigns').set(auth(tutor)).expect(403);
  });

  it('avisa possível duplicidade sem bloquear', async () => {
    const first = (await create(valid()).expect(201)).body.data;
    const second = await create({ ...valid(), title: 'VACINAÇÃO ANTIRRÁBICA GRATUITA' }).expect(201);
    expect(second.body.data.warnings).toEqual([{ code: 'POSSIBLE_DUPLICATE', campaignIds: [first.id] }]);
  });

  it('editar campanha publicada devolve para revisão', async () => {
    const campaign = await published();
    const res = await ctx
      .http()
      .patch(`/api/v1/admin/campaigns/${campaign.id}`)
      .set(auth(admin))
      .send({ location: 'Parque da Jaqueira' })
      .expect(200);
    expect(res.body.data).toMatchObject({ status: 'UNDER_REVIEW', verifiedAt: null });
  });

  it('fonte inacessível é sinalizada para revisão humana e bloqueia nova publicação', async () => {
    const campaign = await published();
    ctx.sources.results.set(valid().sourceUrl, 'UNREACHABLE');
    const run = await ctx
      .http()
      .post('/api/v1/internal/jobs/sources')
      .set('X-Cron-Secret', 'cron-de-teste')
      .expect(200);
    expect(run.body.data.sources).toEqual({ checked: 1, flagged: 1 });
    expect(await ctx.prisma.auditLog.count({ where: { action: 'CAMPAIGN_SOURCE_FLAGGED' } })).toBe(1);

    await ctx
      .http()
      .patch(`/api/v1/admin/campaigns/${campaign.id}`)
      .set(auth(admin))
      .send({ location: 'Outro' })
      .expect(200);
    expect(
      (await ctx.http().post(`/api/v1/admin/campaigns/${campaign.id}/publish`).set(auth(admin)).expect(409)).body.code,
    ).toBe('CAMPAIGN_SOURCE_INVALID');
    ctx.sources.results.clear();
  });
});
