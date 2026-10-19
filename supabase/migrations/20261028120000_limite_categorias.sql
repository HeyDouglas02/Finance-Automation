-- =====================================================================
-- Finance · 017 · Limite de cada categoria em % da renda do mês (regra 12)
-- Vazio = sem limite. A conta (gasto ÷ renda) é feita no app.
-- =====================================================================

alter table categorias
  add column limite_percentual numeric(5,2) check (limite_percentual > 0 and limite_percentual <= 100);
