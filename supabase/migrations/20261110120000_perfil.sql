-- =====================================================================
-- Finance · 029 · Nome de quem usa o app (Perfil, regra 22)
-- Antes o "Olá, Douglas" era fixo no código; com um app por pessoa,
-- cada um cadastra o próprio nome em Mais → Perfil.
-- =====================================================================

alter table configuracoes
  add column nome text check (nome is null or length(trim(nome)) > 0);
