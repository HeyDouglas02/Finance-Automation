-- =====================================================================
-- Finance · 011 · classificar(): categoria + divisão de uma compra (regra 11)
-- Tudo numa transação só: o app nunca grava pela metade.
-- Parcela: vale para ela e as seguintes da mesma compra (mesmo agrupamento
-- da v_itens: cartão + descrição + total de parcelas + mês da compra).
-- security invoker: roda com as permissões de quem chama (RLS: só o dono).
--
-- p_rateios: [{"pessoa_id": 3, "percentual": 50}, {"pessoa_id": 1, "valor": 20}]
--            vazio = a compra é toda do dono
-- Devolve quantas transações foram classificadas.
-- =====================================================================

create function public.classificar(p_transacao text, p_categoria smallint, p_rateios jsonb default '[]')
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  t      transacoes%rowtype;
  alvos  text[];
  partes numeric;
begin
  select * into t from transacoes where id = p_transacao;
  if not found then
    raise exception 'Compra não encontrada';
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

  -- parte dos outros (valor fixo + %) não pode passar do valor da compra
  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(t.valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(t.valor) + 0.005 then
    raise exception 'A divisão passa do valor da compra';
  end if;

  alvos := array[t.id];
  if t.parcela_total is not null then
    select array_agg(x.id) into alvos
    from transacoes x
    where x.tipo = 'gasto'
      and x.cartao_id = t.cartao_id
      and x.parcela_total = t.parcela_total
      and upper(regexp_replace(x.descricao, '\s+', ' ', 'g')) = upper(regexp_replace(t.descricao, '\s+', ' ', 'g'))
      and coalesce(to_char(date_trunc('month', x.compra_original), 'YYYY-MM'), '')
        = coalesce(to_char(date_trunc('month', t.compra_original), 'YYYY-MM'), '')
      and x.parcela_num >= t.parcela_num;
  end if;

  update transacoes
     set categoria_id = p_categoria, revisado = true, atualizado_em = now()
   where id = any(alvos);

  delete from rateios where transacao_id = any(alvos);

  insert into rateios (transacao_id, pessoa_id, valor, percentual)
  select a, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from unnest(alvos) a
  cross join jsonb_array_elements(p_rateios) r;

  return array_length(alvos, 1);
end;
$$;

revoke all on function public.classificar(text, smallint, jsonb) from public, anon;
grant execute on function public.classificar(text, smallint, jsonb) to authenticated;
