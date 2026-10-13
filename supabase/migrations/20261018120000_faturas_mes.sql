-- =====================================================================
-- Finance · 007 · Fatura de cada cartão por mês do orçamento
-- Fatura fechada: vale o total do banco. Fatura aberta: soma das compras
-- que já chegaram. Competência = mês anterior ao vencimento (regra 1).
-- =====================================================================

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
juntas as (
  select coalesce(b.cartao_id, x.cartao_id) as cartao_id,
         coalesce(b.competencia, x.competencia) as competencia,
         b.vencimento, b.total, x.soma_compras, x.itens,
         b.cartao_id is not null as fechada
  from compras x
  full join banco b on b.cartao_id = x.cartao_id and b.competencia = x.competencia
)
select j.competencia,
       c.nome as cartao,
       -- aberta: vencimento calculado pelo dia do cartão (limitado ao último dia do mês)
       coalesce(j.vencimento,
         (j.competencia + interval '1 month')::date
           + least(c.dia_vencimento, extract(day from j.competencia + interval '2 month' - interval '1 day')::int) - 1
       ) as vencimento,
       coalesce(j.total, j.soma_compras) as total,
       coalesce(j.soma_compras, 0) as soma_compras,
       coalesce(j.itens, 0) as itens,
       j.fechada
from juntas j
join cartoes c on c.id = j.cartao_id;


grant select on v_faturas_mes to authenticated;
