import { TestContext, auth, createTestApp, createUser, resetDatabase, tokenFor } from './helpers';
import { JwtService } from '@nestjs/jwt';

describe('Segurança compartilhada', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetDatabase(ctx.prisma));

  it('health e versão são públicos e seguem o envelope { data }', async () => {
    const res = await ctx.http().get('/api/v1/health').expect(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('rota privada sem token responde 401 no formato de erro padrão', async () => {
    const res = await ctx.http().get('/api/v1/appointments').expect(401);
    expect(res.body).toEqual({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: expect.any(String),
      requestId: expect.any(String),
    });
  });

  it('token assinado com outro segredo ou de outro tipo é recusado', async () => {
    const user = await createUser(ctx.prisma);
    const forged = new JwtService({ secret: 'outro-segredo' }).sign({ sub: user.id, role: 'TUTOR', typ: 'access' });
    await ctx.http().get('/api/v1/appointments').set('Authorization', `Bearer ${forged}`).expect(401);

    const refresh = new JwtService({ secret: 'segredo-de-teste-com-tamanho-suficiente-123' }).sign({
      sub: user.id,
      role: 'TUTOR',
      typ: 'refresh',
    });
    await ctx.http().get('/api/v1/appointments').set('Authorization', `Bearer ${refresh}`).expect(401);
  });

  it('papel incorreto responde 403', async () => {
    const tutor = await createUser(ctx.prisma, 'TUTOR');
    const res = await ctx.http().get('/api/v1/admin/verification-requests').set(auth(tutor)).expect(403);
    expect(res.body.code).toBe('ACCESS_DENIED');
    await ctx.http().post('/api/v1/availability').set(auth(tutor)).send({}).expect(403);
  });

  it.each(['BLOCKED', 'DELETION_PENDING'] as const)('conta %s perde acesso mesmo com token válido', async (status) => {
    const user = await createUser(ctx.prisma, 'TUTOR', status);
    const res = await ctx
      .http()
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .expect(403);
    expect(res.body.code).toBe('USER_BLOCKED');
  });

  it('DTO rejeita campos desconhecidos', async () => {
    const pro = await createUser(ctx.prisma, 'PROFESSIONAL');
    const res = await ctx
      .http()
      .post('/api/v1/professionals/me')
      .set(auth(pro))
      .send({ displayName: 'Dr. X', crmvNumber: '1234', crmvState: 'PE', verificationStatus: 'APPROVED' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('id malformado responde 404 sem vazar erro do banco', async () => {
    const tutor = await createUser(ctx.prisma);
    await ctx.http().get('/api/v1/appointments/nao-e-uuid').set(auth(tutor)).expect(404);
  });
});
