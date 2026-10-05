# 0001 — Contratos provisórios do bloco do José

Data: 05/10/2026
Situação: aceita, até a integração do código do José

## Contexto

O handoff do José (29/09/2026) diz que J1–J6 estão na `develop` do `vizipet-backend`. O repositório usado aqui começou vazio. Pedro e Guilherme dependem de `JwtAuthGuard`, `ActiveUserGuard`, `RolesGuard`, `CurrentUser`, `assertUserActive` e `assertPetOwnership`.

## Decisão

Criar implementações mínimas desses contratos, com as mesmas assinaturas do handoff e do manual (seção 18), em `src/auth` e `src/pets`. O schema já inclui as tabelas do José com os nomes do handoff (`users`, `auth_sessions`, `password_reset_tokens`, `pets`, `species`, `legal_acceptances`, `privacy_requests`, `notification_preferences`).

Não foram implementados cadastro, login, refresh, recuperação de senha, CRUD de pets nem privacidade. Isso continua sendo do José.

## Consequências

- Os módulos do Pedro e do Guilherme e os testes e2e funcionam hoje, gerando tokens direto com `JWT_ACCESS_SECRET`.
- Na integração, o código do José substitui `src/auth` e `src/pets`. É preciso conferir: nome das claims do access token (`sub`, `role`, `typ: "access"`), códigos de erro (`USER_BLOCKED`, `PET_NOT_FOUND`, `PET_NOT_OWNED`) e se `species`/`pets` batem com o schema atual.
- Qualquer diferença de assinatura entre o código do José e este documento deve ser discutida com os três antes do merge, não ajustada em silêncio.
