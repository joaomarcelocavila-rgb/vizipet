# 0002 — Node 24 e Vitest

Data: 05/10/2026
Situação: aceita

## Contexto

O NestJS 12 é distribuído só como ESM. O Jest 30 não consegue carregar `@nestjs/*` em modo CommonJS sem transformar `node_modules`, e o handoff já fixa Node 24 como runtime do projeto.

## Decisão

- `.nvmrc` e `engines` em Node 24.
- Testes com Vitest + `unplugin-swc` (mantém `emitDecoratorMetadata`, que a injeção de dependência do Nest precisa). A API é compatível com a do Jest (`describe`, `it`, `expect`, `it.each`).
- O código da aplicação continua compilando para CommonJS com `nest build`; o Node 24 carrega os pacotes ESM do Nest via `require(esm)`.

## Consequências

`npm test` roda os unitários de `src/**/*.spec.ts`; `npm run test:e2e` roda `test/**/*.e2e-spec.ts` em série, porque todas as suítes usam o mesmo banco de teste.
