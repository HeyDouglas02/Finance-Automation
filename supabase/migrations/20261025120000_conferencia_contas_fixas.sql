-- =====================================================================
-- Finance · 014 · Conferência de faturas e mudança de valor de conta fixa
--
-- v_faturas_mes ganha soma_compras e encargos (regra 10): na fatura
-- fechada, diferença = total do banco − soma das compras recebidas.
-- Colunas novas só no fim, então "create or replace" basta.
--
-- mudar_valor_conta_fixa(): regra 3, "mudou o valor: encerra a conta
-- antiga e cria uma nova", numa transação só. Se a mudança vale desde o
-- início da conta, só troca o valor.
-- =====================================================================

create or replace view v_faturas_mes with (security_invoker = true) as
with compras as (
  select cartao_id, competencia, sum(valor) as soma_compras, count(*) as itens
  from transacoes
  where tipo = 'gasto'
  group by cartao_id, competencia
),
banco as (
  select cartao_id, (date_trunc('month', vencimento) - interval '1 month')::date as competencia,
         vencimento, total, encargos
  from faturas
),
previstos as (
  select c.id as cartao_id, i.competencia, sum(i.valor) as previsto
  from v_itens i
  join cartoes c on c.nome = i.origem
  where i.status = 'Previsto'
  group by c.id, i.competencia
),
reais as (
  select coalesce(b.cartao_id, x.cartao_id) as cartao_id,
         coalesce(b.competencia, x.competencia) as competencia,
         b.vencimento, b.total, b.encargos, x.soma_compras, x.itens,
         b.cartao_id is not null as fechada
  from compras x
  full join banco b on b.cartao_id = x.cartao_id and b.competencia = x.competencia
),
juntas as (
  select coalesce(r.cartao_id, p.cartao_id) as cartao_id,
         coalesce(r.competencia, p.competencia) as competencia,
         r.vencimento, r.total, r.encargos, r.soma_compras, r.itens,
         coalesce(r.fechada, false) as fechada,
         -- fatura fechada já tem o valor final: previsão não soma
         case when coalesce(r.fechada, false) then 0 else coalesce(p.previsto, 0) end as previsto
  from reais r
  full join previstos p on p.cartao_id = r.cartao_id and p.competencia = r.competencia
)
select j.competencia,
       c.nome as cartao,
       -- sem fatura do banco: vencimento pelo dia do cartão (limitado ao último dia do mês)
       coalesce(j.vencimento,
         (j.competencia + interval '1 month')::date
           + least(c.dia_vencimento, extract(day from j.competencia + interval '2 month' - interval '1 day')::int) - 1
       ) as vencimento,
       coalesce(j.total, j.soma_compras, 0) as real,
       j.previsto,
       coalesce(j.total, j.soma_compras, 0) + j.previsto as total,
       coalesce(j.itens, 0) as itens,
       j.fechada,
       -- conferência (regra 10): só faz sentido em fatura fechada
       coalesce(j.soma_compras, 0) as soma_compras,
       coalesce(j.encargos, 0) as encargos
from juntas j
join cartoes c on c.id = j.cartao_id;


create function public.mudar_valor_conta_fixa(p_conta int, p_valor numeric, p_a_partir date)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  f    contas_fixas%rowtype;
  mes  date := date_trunc('month', p_a_partir)::date;
  nova int;
begin
  select * into f from contas_fixas where id = p_conta;
  if not found then
    raise exception 'Conta fixa não encontrada';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor inválido';
  end if;
  if f.fim is not null and mes > f.fim then
    raise exception 'Essa conta já foi encerrada';
  end if;

  if mes <= f.inicio then
    update contas_fixas set valor = p_valor where id = f.id;
    return f.id;
  end if;

  update contas_fixas set fim = (mes - interval '1 month')::date where id = f.id;
  insert into contas_fixas (nome, valor, forma, inicio, fim, texto_fatura)
  values (f.nome, p_valor, f.forma, mes, f.fim, f.texto_fatura)
  returning id into nova;
  return nova;
end;
$$;

revoke all on function public.mudar_valor_conta_fixa(int, numeric, date) from public, anon;
grant execute on function public.mudar_valor_conta_fixa(int, numeric, date) to authenticated;
