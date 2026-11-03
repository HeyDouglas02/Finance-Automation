-- =====================================================================
-- Finance · 024 · Cartões arquivados e dias estimados (regra 20)
-- arquivado: some do Lançar e a sincronização para de puxar compras dele;
--   faturas e compras antigas continuam valendo.
-- dias_estimados: cartão criado pela sincronização sem os dias do banco;
--   o app pede para conferir até alguém salvar os dias.
-- =====================================================================

alter table cartoes
  add column arquivado boolean not null default false,
  add column dias_estimados boolean not null default false;
