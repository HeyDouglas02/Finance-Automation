-- =====================================================================
-- Finance · 015 · Sincronização a cada 3 horas (antes: 1×/dia às 06:00)
-- O Meu Pluggy atualiza cada banco 1×/dia, num horário dele (ex.: 20h).
-- Lendo só às 06:00, uma compra podia levar até um dia pra aparecer.
-- A cada 3h o atraso cai pra no máximo 3h. Rodar de novo é seguro:
-- grava por ID da Pluggy (sem duplicar) e preserva a classificação.
-- Horários (UTC): 0,3,6,9,12,15,18,21 = 21h, 0h, 3h, 6h, 9h, 12h, 15h, 18h em Brasília.
-- O job mantém o nome "sync-pluggy-diario" (renomear = apagar e recriar; não vale o risco).
-- =====================================================================

select cron.alter_job(
  job_id   := (select jobid from cron.job where jobname = 'sync-pluggy-diario'),
  schedule := '0 */3 * * *'
);
