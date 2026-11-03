-- =====================================================================
-- Finance · 026 · Configurações do app (regra 22)
-- Uma linha só (id = 1). Por enquanto, a chave Pix da cobrança pelo
-- WhatsApp, que antes era a variável VITE_PIX_CHAVE da Vercel.
-- =====================================================================

create table configuracoes (
  id         smallint primary key default 1 check (id = 1),
  chave_pix  text check (chave_pix is null or length(trim(chave_pix)) > 0)
);
insert into configuracoes (id) values (1);

alter table configuracoes enable row level security;
create policy "somente o dono" on configuracoes for all to authenticated
  using ((select private.eh_dono())) with check ((select private.eh_dono()));
grant select, update on configuracoes to authenticated;
