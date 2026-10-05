# 0003 — Versão pública de profissionais e clínicas

Data: 05/10/2026
Situação: aceita

## Contexto

O manual pede que só a versão aprovada seja pública (P1, G5) e que alterações sensíveis passem por nova revisão.

## Decisão

- `professionals.public_profile` e `clinics.public_profile` guardam o JSON exibido na busca. São gravados na aprovação administrativa.
- Busca e detalhe público só retornam registros `APPROVED` cujo usuário está `ACTIVE`.
- Campos sensíveis: CRMV e UF do profissional; nome, endereço, responsável técnico e CRMV do responsável da clínica. Alterar um deles num perfil aprovado muda o status para `PENDING` (sai da busca até nova aprovação).
- Campos não sensíveis (bio, especialidade, telefone, descrição) de um perfil aprovado atualizam a versão pública na hora.
- Suspensão (`SUSPENDED`) tira o perfil da busca e impede novos agendamentos; reativar volta para `APPROVED` se já houve versão pública, senão para `PENDING`.

## Consequências

Os filtros de cidade e bairro usam as colunas, não o JSON. Como cidade e bairro do profissional não são sensíveis, a busca e a versão pública ficam coerentes.
