-- =====================================================================
-- Finance · 025 · Bancos conectados cadastrados pelo app (regra 21)
-- A lista de conexões do Meu Pluggy sai do segredo PLUGGY_ITEM_IDS e passa
-- a ser a própria tabela conexoes: o app insere o código (item_id) e a
-- sincronização lê daqui. arquivada = desconectado (não lê mais; histórico fica).
-- As conexões que já existem continuam iguais.
-- =====================================================================

alter table conexoes
  add column arquivada boolean not null default false;
