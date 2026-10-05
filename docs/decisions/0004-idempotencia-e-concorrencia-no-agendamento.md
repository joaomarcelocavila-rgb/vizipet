# 0004 — Idempotência e concorrência no agendamento

Data: 05/10/2026
Situação: aceita

## Decisão

Dentro de uma única transação:

1. grava `idempotency_keys(user_id, operation, key)` — a constraint única serializa requisições com a mesma chave;
2. `reserveSlot` faz `UPDATE ... WHERE status = 'AVAILABLE' AND starts_at > now()`; se nenhuma linha mudar, 409 `SLOT_NOT_AVAILABLE`;
3. cria o `appointment` com o snapshot (serviço, duração, modalidade, preço, profissional, clínica, pet, tutor);
4. salva na chave o hash do corpo e o id do agendamento;
5. grava `APPOINTMENT_CONFIRMED` na Outbox.

Se o passo 1 bater na constraint, a requisição espera a outra terminar e devolve o resultado gravado. Corpo diferente com a mesma chave é 409 `IDEMPOTENCY_KEY_REUSED`. Se a transação falhar (ex.: horário ocupado), a chave some junto e pode ser reutilizada.

Como última barreira, `appointments` tem índice único parcial em `slot_id` para status `CONFIRMED`/`COMPLETED`.

## Testes

`test/appointments.e2e-spec.ts` cobre clique repetido, a mesma chave em paralelo e cinco tutores disputando o mesmo horário.
