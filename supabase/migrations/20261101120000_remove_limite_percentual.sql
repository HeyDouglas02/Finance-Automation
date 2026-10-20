-- =====================================================================
-- Finance · 021 · Remove categorias.limite_percentual
-- Era a regra 12 antiga (limite em % da renda por categoria), trocada pelos
-- limites em reais por grupo (regras 12 a 17, migration 018). O app novo
-- não usa mais a coluna (etapa 4 publicada em 20/10/2026).
-- A migration que criou a coluna (20261028120000) continua no repositório.
-- =====================================================================

alter table categorias drop column limite_percentual;
