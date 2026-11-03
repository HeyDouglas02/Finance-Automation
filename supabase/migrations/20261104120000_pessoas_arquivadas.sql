-- =====================================================================
-- Finance · 023 · Pessoas arquivadas (regra 19)
-- Nada é excluído: arquivar tira a pessoa da lista de divisão, mas os
-- rateios, pagamentos e acertos dela continuam valendo.
-- =====================================================================

alter table pessoas
  add column arquivada boolean not null default false;
