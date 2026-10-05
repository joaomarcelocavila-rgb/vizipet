# vizipet-backend

API do Vizipet: monólito modular em NestJS 12 + TypeScript, PostgreSQL e Prisma 7.

O manual de desenvolvimento do back end continua sendo a referência de requisitos. Este README explica como rodar o projeto e o que já existe no código.

## Requisitos

- Node 24 (ver `.nvmrc`) e npm
- PostgreSQL 14+ com as extensões `btree_gist`, `unaccent` e `pg_trgm` disponíveis (vêm no pacote padrão do Postgres e no Supabase)

## Primeira execução

```bash
cp .env.example .env          # ajuste DATABASE_URL e os segredos
npm ci
npx prisma generate
npx prisma migrate dev        # aplica as migrations no banco local
npm run seed                  # dados fictícios: admin, tutor, veterinário, clínica, serviço e horários
npm run start:dev
```

- Swagger: http://localhost:3000/api/docs (desligado em produção)
- Health check: `GET /api/v1/health`
- Versão: `GET /api/v1/version`

O login ainda não está nesta base (ver "Bloco do José" abaixo). Para testar rotas privadas pelo Swagger, gere um token de desenvolvimento para um usuário do seed e use o botão Authorize:

```bash
npm run dev:token -- tutor@vizipet.test
npm run dev:token -- vet@vizipet.test
npm run dev:token -- admin@vizipet.test
```

## App (`web/`)

App em React + Vite, feito primeiro para o celular (barra de navegação embaixo, folhas que sobem de baixo, alvos de toque grandes, tema escuro automático). Em telas largas a barra vira menu lateral. São três áreas, escolhidas pelo papel do usuário:

- **Tutor**: início com a próxima consulta e os pets, busca com filtros rápidos e "perto de mim", perfil do profissional com agendamento, consultas (cancelar, rota até a clínica), campanhas e notificações.
- **Emergência**: plantões 24h ordenados pela distância do celular, com botão de ligar, rota no Google Maps ou Waze e primeiros socorros. Funciona **sem login** (`/emergencia`).
- **Clínica / veterinário**: agenda do dia, abertura de horários em lote, cadastro da clínica (com "atende urgência 24h" e localização no mapa), serviços, perfil profissional, documentos e pedido de verificação.
- **Administração**: painel, análise de cadastros (documentos, aprovar, pedir correção, recusar), rede de clínicas e profissionais (suspender e reativar), campanhas e histórico de auditoria.

```bash
# com a API rodando em :3000 e NODE_ENV=development
cd web
npm ci
npm run dev        # http://localhost:5173
```

A tela de entrada lista os usuários do seed e emite um token via `POST /api/v1/dev/login`. As rotas `/dev/*` (login sem senha e lista de pets do tutor) só existem com `NODE_ENV=development` e saem quando o AuthModule e o PetsModule do José entrarem. `npm run build:demo` gera `web/dist-demo/index.html`, um arquivo único que roda sem API: um back end simulado no navegador reproduz as regras principais. Serve para mostrar o produto a quem não vai instalar nada.

Clínicas com `emergency24h = true` aparecem em `GET /api/v1/search/clinics?emergency=true&lat=..&lng=..`, da mais próxima para a mais distante. Ligar ou desligar esse campo numa clínica aprovada manda a clínica de volta para análise.

### Instalar como aplicativo

O app é um PWA: tem manifesto, ícones e service worker (`web/public/sw.js`). Com o app aberto pelo endereço `https`:

- **Android (Chrome)**: aparece o cartão "Instalar o Vizipet" na tela de entrada ou no Perfil. Também dá pelo menu ⋮ → "Instalar app".
- **iPhone (Safari)**: Compartilhar → "Adicionar à Tela de Início". O app mostra esse passo a passo.

Instalado, ele abre em tela cheia, com ícone próprio e atalho "Emergência" (toque longo no ícone, no Android). Sem internet, a casca do app abre e a tela de emergência mostra a última lista de plantões salva, com os telefones. As respostas da API nunca ficam em cache.

A demonstração é publicada no GitHub Pages pelo workflow `.github/workflows/pages.yml`. Na primeira vez, ative em Settings → Pages → Source: "GitHub Actions".

Para ver a notificação de confirmação aparecer, rode o job da Outbox (`POST /api/v1/internal/jobs/outbox`) ou suba a API com `INTERNAL_JOBS=true`.

## Verificação antes do PR

```bash
npx prisma format && npx prisma validate && npx prisma generate
npm run lint
npm run typecheck
npm test            # unitários (src/**/*.spec.ts)
npm run test:e2e    # HTTP + banco real (test/**/*.e2e-spec.ts)
npm run build
```

Os testes e2e usam o banco de `TEST_DATABASE_URL` (padrão `postgresql://vizipet:vizipet@localhost:5432/vizipet_test`). A suíte aplica as migrations pendentes e limpa as tabelas com TRUNCATE entre os testes, então **nunca aponte essa variável para o Neon/Supabase compartilhado**. O setup se recusa a rodar se o nome do banco não contiver `test`.

## Organização

```
src/
  auth/            guards, @CurrentUser, @Roles, @Protected, assertUserActive   (José)
  pets/            assertPetOwnership                                           (José)
  professionals/   perfil profissional                                          (Pedro)
  clinics/         clínicas e vínculo com profissionais                         (Pedro)
  services/        serviços, espécies aceitas, profissionais que atendem        (Pedro)
  availability/    horários, geração em lote, reserveSlot/releaseSlot           (Pedro)
  search/          busca pública de profissionais e clínicas                    (Pedro)
  verification/    documentos privados e pedido de verificação                  (Pedro)
  storage/         StorageService (driver local e Supabase)                     (Pedro)
  appointments/    criação com idempotência, agenda, cancelamento, conclusão    (Guilherme)
  campaigns/       campanhas públicas com fonte oficial                         (Guilherme)
  notifications/   Outbox, processador, central de notificações                 (Guilherme)
  admin/           fila de verificação, decisões, suspensão, auditoria          (Guilherme)
  audit/           AuditService                                                 (Guilherme)
  jobs/            lembretes, Outbox, campanhas vencidas, checagem de fontes    (Guilherme)
  common/ config/ prisma/ mail/ health/
prisma/
  schema.prisma    todas as tabelas aprovadas, com enums
  migrations/      init + constraints (EXCLUDE, CHECK, índice parcial) + índices de busca
  seed.ts
test/              e2e por módulo
docs/decisions/    decisões técnicas registradas
```

Controllers não acessam o Prisma. Regras ficam nos services, e um módulo usa o outro pelos métodos públicos combinados no manual.

## Contratos entre módulos

```ts
// José
assertUserActive(userId: string): Promise<void>                 // UserAccessService
assertPetOwnership(petId: string, tutorId: string): Promise<Pet> // PetOwnershipService

// Pedro
validateService(serviceId: string): Promise<ServiceSnapshot>                 // ServicesService
validateProfessional(professionalId: string): Promise<ProfessionalSnapshot>  // ProfessionalsService
validateClinic(clinicId: string): Promise<ClinicSnapshot>                    // ClinicsService
reserveSlot(slotId: string, tx: TransactionClient): Promise<Slot>            // AvailabilityService
releaseSlot(slotId: string, tx: TransactionClient): Promise<void>            // AvailabilityService

// Guilherme
emitOutbox(event: DomainEvent, tx: TransactionClient): Promise<void>         // OutboxService
```

Para proteger um controller, use `@Protected()` (ou `@Protected('TUTOR')`, `@Protected('ADMIN')` etc.). Ele aplica `JwtAuthGuard`, `ActiveUserGuard` e `RolesGuard` nessa ordem e documenta o Bearer no Swagger. O usuário vem de `@CurrentUser()`; nunca leia `ownerId`/`tutorId` do corpo.

## Bloco do José

O handoff de 29/09/2026 descreve J1–J6 como entregues na `develop` do `vizipet-backend`, mas esse código não está neste repositório. Para não travar Pedro e Guilherme, a base traz só o necessário para os contratos funcionarem, com as assinaturas do handoff:

- `JwtAuthGuard` valida o access token (HS256, `JWT_ACCESS_SECRET`, `typ: "access"`, `sub` e `role`)
- `ActiveUserGuard` e `UserAccessService.assertUserActive` barram contas `BLOCKED`, `DELETION_PENDING` e `DELETED`
- `RolesGuard`, `@Roles`, `@CurrentUser`, `AuthenticatedUser`
- `PetOwnershipService.assertPetOwnership` (pet removido → 404 `PET_NOT_FOUND`; de outro tutor → 403 `PET_NOT_OWNED`)
- As tabelas do José estão no schema com os nomes e campos do handoff

Cadastro, login, refresh, recuperação de senha, CRUD de pets e privacidade **não** foram reescritos. Ao trazer o código do José, os arquivos de `src/auth` e `src/pets` dele substituem estes; se as assinaturas baterem, nenhum módulo do Pedro ou do Guilherme muda. Detalhes em `docs/decisions/0001-contratos-provisorios-do-bloco-jose.md`.

A Outbox já trata `PASSWORD_RESET_REQUESTED` (payload `{ userId, resetUrl }`), então o J4 só precisa chamar `emitOutbox` na mesma transação em que grava o token. A tarefa de anonimização do J6 continua pendente: depende da matriz de retenção, que ainda não foi aprovada.

## Regras que valem a pena saber

- Respostas de sucesso vêm em `{ data }`; listas em `{ data, meta: { page, limit, total, totalPages } }`. Erros seguem `{ statusCode, code, message, requestId }`, com `details` quando há campos inválidos.
- Datas de entrada exigem fuso explícito (`2026-10-20T09:00:00-03:00`). Tudo é gravado em UTC. A geração em lote recebe `HH:mm` e um `timeZone` (padrão `America/Recife`).
- Sobreposição de horários do mesmo profissional é barrada no service e, por garantia, por uma constraint `EXCLUDE` no banco.
- Um horário só tem um agendamento ativo: índice único parcial em `appointments(slot_id)` para `CONFIRMED`/`COMPLETED`.
- `POST /appointments` exige `Idempotency-Key` (8–128 caracteres). Repetir a chave com o mesmo corpo devolve o mesmo agendamento; com outro corpo, 409 `IDEMPOTENCY_KEY_REUSED`.
- Perfis de profissional e clínica só aparecem na busca com status `APPROVED`. A versão pública (`public_profile`) é gravada na aprovação; mudar CRMV, nome ou endereço de um perfil aprovado devolve o perfil para `PENDING`.
- Documentos ficam em bucket privado. O caminho nunca sai da API; o admin recebe um link de 2 minutos e a visualização vai para o `audit_logs`.
- E-mails e notificações saem da Outbox, nunca da requisição principal. Falha de e-mail não desfaz nada; são até 5 tentativas com espera crescente.

## Rotinas agendadas

Endpoint `POST /api/v1/internal/jobs/:name` com o cabeçalho `X-Cron-Secret: $CRON_SECRET`.

| name        | o que faz                                                     | sugestão de agenda |
|-------------|---------------------------------------------------------------|--------------------|
| `outbox`    | processa até 20 eventos pendentes                             | a cada minuto      |
| `reminders` | enfileira lembretes de 24 h (chave `appointment:{id}:reminder:24h`) | a cada 15 min |
| `campaigns` | encerra campanhas publicadas cujo `endsAt` passou             | a cada hora        |
| `sources`   | confere se as fontes oficiais respondem e sinaliza as que não | a cada 6 h         |
| `all`       | reminders + campaigns + outbox                                | —                  |

Todas podem rodar repetidas ou em paralelo sem duplicar efeito. Exemplo de agendamento no Supabase Cron:

```sql
select cron.schedule('vizipet-outbox', '* * * * *', $$
  select net.http_post(
    url := 'https://SUA-API/api/v1/internal/jobs/outbox',
    headers := jsonb_build_object('X-Cron-Secret', current_setting('app.cron_secret'))
  );
$$);
```

Em ambiente sem cron, `INTERNAL_JOBS=true` liga um timer interno que roda `all` a cada 60 s.

## Pendências conhecidas

- Integrar o código real do bloco do José (auth, usuários, pets, privacidade) — ver seção acima.
- Anonimização/remoção de arquivos na exclusão de conta: aguarda a matriz de retenção LGPD.
- Teste da migration sobre a versão anterior do banco: só faz sentido depois que o schema do José entrar; hoje existe apenas o caminho a partir do banco vazio.
- Checagem de fontes resolve o DNS e recusa IP privado antes da requisição, mas não fixa o IP resolvido (janela de DNS rebinding). Aceitável para homologação; rever antes do lançamento.
