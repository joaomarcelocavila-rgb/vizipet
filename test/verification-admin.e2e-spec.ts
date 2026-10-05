import { TestContext, auth, createTestApp, createUser, resetDatabase } from './helpers';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('P5/G5 documentos, verificação e administração', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(() => resetDatabase(ctx.prisma));

  async function pendingProfessional() {
    const user = await createUser(ctx.prisma, 'PROFESSIONAL');
    const professional = (
      await ctx
        .http()
        .post('/api/v1/professionals/me')
        .set(auth(user))
        .send({
          displayName: 'Dra. Bia',
          crmvNumber: '7777',
          crmvState: 'PE',
          city: 'Recife',
          neighborhood: 'Derby',
          specialty: 'Felinos',
        })
        .expect(201)
    ).body.data;
    return { user, professional };
  }

  const upload = (user: { id: string; role: string }, kind: string, file: Buffer, name: string) =>
    ctx
      .http()
      .post('/api/v1/verification/documents')
      .set(auth(user))
      .field('target', 'PROFESSIONAL')
      .field('kind', kind)
      .attach('file', file, name);

  async function submitted() {
    const s = await pendingProfessional();
    await upload(s.user, 'CRMV', PDF, 'crmv.pdf').expect(201);
    await upload(s.user, 'IDENTITY', PNG, 'rg.png').expect(201);
    const request = (
      await ctx
        .http()
        .post('/api/v1/verification/requests')
        .set(auth(s.user))
        .send({ target: 'PROFESSIONAL' })
        .expect(201)
    ).body.data;
    const admin = await createUser(ctx.prisma, 'ADMIN');
    return { ...s, request, admin };
  }

  describe('upload', () => {
    it('aceita PDF válido e não devolve o caminho no storage', async () => {
      const { user } = await pendingProfessional();
      const res = await upload(user, 'CRMV', PDF, 'meu crmv.pdf').expect(201);
      expect(res.body.data).toMatchObject({ kind: 'CRMV', mimeType: 'application/pdf', originalName: 'meu crmv.pdf' });
      expect(JSON.stringify(res.body)).not.toMatch(/documents\//);
    });

    it('recusa extensão falsa, SVG, executável e extensão dupla', async () => {
      const { user } = await pendingProfessional();
      expect((await upload(user, 'CRMV', PNG, 'crmv.pdf').expect(400)).body.code).toBe('FILE_TYPE_MISMATCH');
      expect(
        (await upload(user, 'CRMV', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg').expect(400)).body
          .code,
      ).toBe('FILE_TYPE_NOT_ALLOWED');
      expect((await upload(user, 'CRMV', Buffer.from('MZ\x90\x00'), 'setup.exe').expect(400)).body.code).toBe(
        'FILE_TYPE_NOT_ALLOWED',
      );
      expect((await upload(user, 'CRMV', PDF, 'nota.php.pdf').expect(400)).body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    });

    it('recusa arquivo acima de 10 MB', async () => {
      const { user } = await pendingProfessional();
      const big = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
      await upload(user, 'CRMV', big, 'grande.pdf').expect(413);
    });

    it('tutor não envia nem lista documentos', async () => {
      const tutor = await createUser(ctx.prisma, 'TUTOR');
      await upload(tutor, 'CRMV', PDF, 'x.pdf').expect(403);
      await ctx.http().get('/api/v1/verification/documents?target=PROFESSIONAL').set(auth(tutor)).expect(403);
    });
  });

  describe('solicitação de verificação', () => {
    it('perfil incompleto não vai para análise', async () => {
      const { user } = await pendingProfessional();
      const res = await ctx
        .http()
        .post('/api/v1/verification/requests')
        .set(auth(user))
        .send({ target: 'PROFESSIONAL' })
        .expect(409);
      expect(res.body.code).toBe('VERIFICATION_INCOMPLETE');
      expect(res.body.details.missing).toEqual(['document:CRMV', 'document:IDENTITY']);
    });

    it('perfil completo gera pedido PENDING; segundo envio é recusado', async () => {
      const { user, request } = await submitted();
      expect(request.status).toBe('PENDING');
      const again = await ctx
        .http()
        .post('/api/v1/verification/requests')
        .set(auth(user))
        .send({ target: 'PROFESSIONAL' })
        .expect(409);
      expect(again.body.code).toBe('VERIFICATION_ALREADY_PENDING');
    });
  });

  describe('administração', () => {
    it('lista pendentes sem expor documentos', async () => {
      const { admin } = await submitted();
      const res = await ctx.http().get('/api/v1/admin/verification-requests').set(auth(admin)).expect(200);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.data[0].documents).toBeUndefined();
      expect(res.body.data[0].subject.name).toBe('Dra. Bia');
    });

    it('link temporário só para admin, registrado na auditoria e baixável', async () => {
      const { admin, request, user } = await submitted();
      const detail = (
        await ctx.http().get(`/api/v1/admin/verification-requests/${request.id}`).set(auth(admin)).expect(200)
      ).body.data;
      const doc = detail.documents[0];

      await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/documents/${doc.id}/link`)
        .set(auth(user))
        .expect(403);
      const tutor = await createUser(ctx.prisma, 'TUTOR');
      await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/documents/${doc.id}/link`)
        .set(auth(tutor))
        .expect(403);
      await ctx.http().post(`/api/v1/admin/verification-requests/${request.id}/documents/${doc.id}/link`).expect(401);

      const link = (
        await ctx
          .http()
          .post(`/api/v1/admin/verification-requests/${request.id}/documents/${doc.id}/link`)
          .set(auth(admin))
          .expect(200)
      ).body.data;
      expect(link.expiresInSeconds).toBe(120);
      const file = await ctx.http().get(link.url).expect(200);
      expect(file.headers['content-disposition']).toBe('attachment');

      await ctx
        .http()
        .get(link.url.replace(/signature=[0-9a-f]+/, 'signature=00'))
        .expect(404);
      expect(
        await ctx.prisma.auditLog.count({ where: { action: 'VERIFICATION_DOCUMENT_VIEWED', actorId: admin.id } }),
      ).toBe(1);
    });

    it('pedir correção sem justificativa é recusado', async () => {
      const { admin, request } = await submitted();
      const res = await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'REQUEST_CHANGES' })
        .expect(400);
      expect(res.body.code).toBe('REASON_REQUIRED');
    });

    it('aprovação publica a versão pública, audita e avisa o profissional', async () => {
      const { admin, request, professional } = await submitted();
      const res = await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'APPROVE' })
        .expect(200);
      expect(res.body.data).toMatchObject({ status: 'APPROVED', decidedById: admin.id });

      const updated = await ctx.prisma.professional.findUniqueOrThrow({ where: { id: professional.id } });
      expect(updated.verificationStatus).toBe('APPROVED');
      expect(updated.publicProfile).toMatchObject({ name: 'Dra. Bia', crmv: '7777/PE' });
      expect(await ctx.prisma.auditLog.count({ where: { action: 'VERIFICATION_APPROVED' } })).toBe(1);
      expect(await ctx.prisma.outboxEvent.count({ where: { type: 'VERIFICATION_DECIDED' } })).toBe(1);

      await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'REJECT', reason: 'tarde demais' })
        .expect(409);
    });

    it('correção solicitada permite reenvio', async () => {
      const { admin, request, user } = await submitted();
      await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'REQUEST_CHANGES', reason: 'Documento ilegível' })
        .expect(200);
      const mine = (await ctx.http().get('/api/v1/verification/requests/mine').set(auth(user)).expect(200)).body.data;
      expect(mine[0]).toMatchObject({ status: 'CHANGES_REQUESTED', reason: 'Documento ilegível' });
      await ctx
        .http()
        .post('/api/v1/verification/requests')
        .set(auth(user))
        .send({ target: 'PROFESSIONAL' })
        .expect(201);
    });

    it('perfil suspenso sai da busca e não pode ser decidido', async () => {
      const { admin, request, professional } = await submitted();
      await ctx
        .http()
        .post(`/api/v1/admin/professionals/${professional.id}/suspend`)
        .set(auth(admin))
        .send({ reason: 'Denúncia em apuração' })
        .expect(200);
      const res = await ctx
        .http()
        .post(`/api/v1/admin/verification-requests/${request.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'APPROVE' })
        .expect(409);
      expect(res.body.code).toBe('PROFILE_SUSPENDED');

      const audit = await ctx
        .http()
        .get(`/api/v1/admin/audit-logs?entityId=${professional.id}`)
        .set(auth(admin))
        .expect(200);
      expect(audit.body.data[0]).toMatchObject({ action: 'PROVIDER_SUSPENDED', actorId: admin.id });
    });
  });
});
