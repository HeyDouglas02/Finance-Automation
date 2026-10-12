-- =====================================================================
-- Finance · 005 · Agendamento diário da sincronização com a Pluggy
--
-- pg_cron: "despertador" do Postgres (roda um SQL num horário fixo)
-- pg_net:  faz chamadas HTTP de dentro do banco
-- Vault:   cofre criptografado do Supabase. Guarda o endereço do projeto
--          e o CRON_SECRET, que NÃO ficam escritos aqui (vai pro Git).
--          Os dois são criados à mão, uma vez, no SQL Editor.
--
-- Horário: 09:00 UTC = 06:00 em Brasília (o pg_cron usa UTC).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sync-pluggy-diario',
  '0 9 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
               || '/functions/v1/sync-pluggy',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
