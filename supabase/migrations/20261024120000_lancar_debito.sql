-- =====================================================================
-- Finance · 013 · lancar_debito(): débito + divisão numa transação só (regra 6)
-- Mesmas validações da classificar(): categoria válida, pessoa sem repetir,
-- parte dos outros até o valor (de cada parcela).
-- p_rateios: [{"pessoa_id": 3, "percentual": 50}] · vazio = todo do dono
-- Devolve o id do débito criado.
-- =====================================================================

create function public.lancar_debito(
  p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]')
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  novo   int;
  partes numeric;
begin
  if p_categoria is null or p_categoria = (select id from categorias where nome = 'A revisar') then
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

  insert into debitos (competencia_inicio, descricao, valor, parcelas, categoria_id)
  values (date_trunc('month', p_competencia)::date, trim(p_descricao), p_valor, p_parcelas, p_categoria)
  returning id into novo;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select novo, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;

  return novo;
end;
$$;

revoke all on function public.lancar_debito(date, text, numeric, smallint, smallint, jsonb) from public, anon;
grant execute on function public.lancar_debito(date, text, numeric, smallint, smallint, jsonb) to authenticated;
