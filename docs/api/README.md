# API

A documentação viva é o Swagger, gerado a partir dos controllers e DTOs: `GET /api/docs` em desenvolvimento.

Para exportar o JSON (útil para o front ou para clientes HTTP como Bruno e Insomnia), suba a API e baixe `GET /api/docs-json`.

Fluxo completo de agendamento, do ponto de vista do front:

1. `GET /api/v1/search/professionals?q=...&speciesId=...&date=AAAA-MM-DD`
2. `GET /api/v1/search/professionals/{id}` e `GET /api/v1/search/professionals/{id}/slots?serviceId=...`
3. `POST /api/v1/appointments` com `Idempotency-Key` (gere um UUID por tentativa de agendamento, não por clique)
4. `GET /api/v1/appointments?scope=upcoming`
5. `POST /api/v1/appointments/{id}/cancel`
