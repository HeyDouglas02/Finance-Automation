-- =====================================================================
-- Finance · 004 · Segurança: acesso só para o dono
--
-- Antes: qualquer usuário logado acessava tudo (seguro só porque os
-- cadastros estão fechados). Agora: só quem está na lista de donos.
-- É uma segunda camada: mesmo que outra conta exista, ela não vê nada.
--
-- A lista de donos fica num schema privado, fora da API.
-- O ID do dono NÃO fica no Git: é inserido à mão, uma vez, no SQL Editor.
-- =====================================================================

-- 1) Schema privado (não exposto pela API REST)
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.donos (
  user_id uuid primary key references auth.users on delete cascade
);
revoke all on private.donos from public, anon, authenticated;

-- 2) Função que responde "o usuário logado é dono?"
--    security definer: lê private.donos sem dar acesso direto à tabela.
create function private.eh_dono() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.donos where user_id = auth.uid());
$$;
revoke all on function private.eh_dono() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.eh_dono() to authenticated;

-- 3) Troca a regra em todas as tabelas: de "qualquer logado" para "só o dono"
do $$
declare t text;
begin
  foreach t in array array['pessoas','categorias','cartoes','regras_categoria','contas_fixas',
                           'faturas','transacoes','conexoes','renda','debitos','abastecimentos',
                           'pagamentos','rateios'] loop
    execute format('drop policy if exists "apenas usuario logado" on %I', t);
    -- (select ...) faz o Postgres calcular uma vez por consulta, não por linha
    execute format('create policy "somente o dono" on %I for all to authenticated
                    using ((select private.eh_dono())) with check ((select private.eh_dono()))', t);
  end loop;
end $$;

-- 4) Função criada pelo "Enable automatic RLS" do Supabase: tirar da API pública.
--    O gatilho que liga o RLS em tabelas novas continua funcionando
--    (quem dispara é o próprio banco, não precisa de permissão de execução).
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
