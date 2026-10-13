-- =====================================================================
-- Finance · 008 · v_faturas_mes passa a incluir as parcelas previstas
-- (faturas abertas e futuras deixam de aparecer vazias)
-- real:     fatura fechada = total do banco; aberta = compras que já chegaram
-- previsto: parcelas que ainda não entraram na fatura (geradas pela v_itens)
-- Competência = mês anterior ao vencimento (regra 1).
-- =====================================================================

drop view v_faturas_mes;

create view v_faturas_mes with (security_invoker = true) as
with compras as (
  select cartao_id, competencia, sum(valor) as soma_compras, count(*) as itens
  from transacoes
  where tipo = 'gasto'
  group by cartao_id, competencia
),
banco as (
  select cartao_id, (date_trunc('month', vencimento) - interval '1 month')::date as competencia,
         vencimento, total
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
         b.vencimento, b.total, x.soma_compras, x.itens,
         b.cartao_id is not null as fechada
  from compras x
  full join banco b on b.cartao_id = x.cartao_id and b.competencia = x.competencia
),
juntas as (
  select coalesce(r.cartao_id, p.cartao_id) as cartao_id,
         coalesce(r.competencia, p.competencia) as competencia,
         r.vencimento, r.total, r.soma_compras, r.itens,
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
       j.fechada
from juntas j
join cartoes c on c.id = j.cartao_id;


grant select on v_faturas_mes to authenticated;
