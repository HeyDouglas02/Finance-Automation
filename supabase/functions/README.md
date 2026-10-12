# Edge Functions

- `sync-pluggy`: busca transações e faturas na Pluggy todo dia (pg_cron, 06:00 BRT) e grava nas tabelas. Protegida pelo cabeçalho `x-cron-secret`.
