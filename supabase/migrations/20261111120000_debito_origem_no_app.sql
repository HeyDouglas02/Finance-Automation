-- =====================================================================
-- Finance · 030 · Lançar e corrigir débito com "quem pagou por mim" (regra 18)
-- lancar_debito() e editar_debito() ganham p_origem (vazio = eu paguei).
-- Parâmetro novo muda a assinatura: as versões antigas são apagadas antes,
-- senão ficariam duas funções com o mesmo nome.
-- =====================================================================

drop function public.lancar_debito(date, text, numeric, smallint, smallint, jsonb);
drop function public.editar_debito(int, date, text, numeric, smallint, smallint, jsonb);

create or replace function public.lancar_debito(
  p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]', p_origem text default null)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  novo   int;
  partes numeric;
begin
  if p_categoria is null then
    raise exception 'Escolha uma categoria';
  end if;

  if jsonb_typeof(p_rateios) <> 'array' then
    raise exception 'Divisão inválida';
  end if;

  if (select count(*) <> count(distinct r->>'pessoa_id') from jsonb_array_elements(p_rateios) r) then
    raise exception 'A mesma pessoa aparece duas vezes na divisão';
  end if;

  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(p_valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(p_valor) + 0.005 then
    raise exception 'A divisão passa do valor';
  end if;

  insert into debitos (competencia_inicio, descricao, valor, parcelas, categoria_id, origem)
  values (date_trunc('month', p_competencia)::date, trim(p_descricao), p_valor, p_parcelas, p_categoria, nullif(trim(p_origem), ''))
  returning id into novo;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select novo, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;

  return novo;
end;
$$;

create or replace function public.editar_debito(
  p_debito int, p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]', p_origem text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  partes numeric;
begin
  if not exists (select 1 from debitos where id = p_debito) then
    raise exception 'Débito não encontrado';
  end if;

  if p_categoria is null then
    raise exception 'Escolha uma categoria';
  end if;

  if jsonb_typeof(p_rateios) <> 'array' then
    raise exception 'Divisão inválida';
  end if;

  if (select count(*) <> count(distinct r->>'pessoa_id') from jsonb_array_elements(p_rateios) r) then
    raise exception 'A mesma pessoa aparece duas vezes na divisão';
  end if;

  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(p_valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(p_valor) + 0.005 then
    raise exception 'A divisão passa do valor';
  end if;

  update debitos
     set competencia_inicio = date_trunc('month', p_competencia)::date, descricao = trim(p_descricao),
         valor = p_valor, parcelas = p_parcelas, categoria_id = p_categoria, origem = nullif(trim(p_origem), '')
   where id = p_debito;

  delete from rateios where debito_id = p_debito;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select p_debito, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;
end;
$$;

revoke all on function public.lancar_debito(date, text, numeric, smallint, smallint, jsonb, text) from public, anon;
grant execute on function public.lancar_debito(date, text, numeric, smallint, smallint, jsonb, text) to authenticated;
revoke all on function public.editar_debito(int, date, text, numeric, smallint, smallint, jsonb, text) from public, anon;
grant execute on function public.editar_debito(int, date, text, numeric, smallint, smallint, jsonb, text) to authenticated;
