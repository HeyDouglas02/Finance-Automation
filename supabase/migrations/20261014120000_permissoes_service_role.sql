-- =====================================================================
-- Finance · 003 · Permissões para o service_role
-- A Edge Function de sincronização roda como service_role (papel de
-- servidor). Como o projeto não expõe tabelas automaticamente, as
-- permissões precisam ser dadas de forma explícita.
-- =====================================================================

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- tabelas e sequências criadas no futuro também ficam acessíveis
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
