-- =====================================================================
-- Finance · 016 · editar_debito(): corrige um débito + divisão numa transação só
-- Mesmas validações da lancar_debito(). Débito parcelado: vale pra todas
-- as parcelas (é um registro só; as parcelas são geradas pela v_itens).
-- =====================================================================

create function public.editar_debito(
  p_debito int, p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]')
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

  update debitos
     set competencia_inicio = date_trunc('month', p_competencia)::date, descricao = trim(p_descricao),
         valor = p_valor, parcelas = p_parcelas, categoria_id = p_categoria
   where id = p_debito;

  delete from rateios where debito_id = p_debito;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select p_debito, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;
end;
$$;

revoke all on function public.editar_debito(int, date, text, numeric, smallint, smallint, jsonb) from public, anon;
grant execute on function public.editar_debito(int, date, text, numeric, smallint, smallint, jsonb) to authenticated;
