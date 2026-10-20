-- =====================================================================
-- Finance · 020 · v_orcamento_base mais rápida (mesma lógica, mesmas colunas)
-- A versão da 018 lia v_lancamentos três vezes (meses, itens, renda), e
-- v_orcamento_grupos usa a base duas vezes (direto e via v_orcamento_mes):
-- os lançamentos eram recalculados muitas vezes por consulta. Com a tela Mês
-- fazendo várias consultas ao mesmo tempo, passava do tempo limite da API.
-- Aqui os lançamentos são calculados uma vez (CTE materializada) e reaproveitados.
-- =====================================================================

create or replace view v_orcamento_base with (security_invoker = true) as
with
lanc as materialized (
  select l.competencia, l.tipo, l.minha_parte, c.grupo_id
  from v_lancamentos l
  left join categorias c on c.nome = l.categoria
),
meses as (
  select distinct competencia from lanc
),
orc as (
  select m.competencia, o.renda_base, o.reserva, o.meta, o.teto_parcelas
  from meses m
  cross join lateral (
    select * from orcamento o
    where o.inicio <= m.competencia and (o.fim is null or o.fim >= m.competencia)
    order by o.inicio desc limit 1
  ) o
),
gastos as (
  select competencia, grupo_id, sum(minha_parte) as gasto
  from lanc where tipo <> 'Renda' and grupo_id is not null
  group by competencia, grupo_id
),
sem_grupo as (   -- pendentes (sem categoria): saem do saldo, mas não têm grupo
  select competencia, sum(minha_parte) as gasto
  from lanc where tipo <> 'Renda' and grupo_id is null
  group by competencia
),
renda as (
  select competencia, sum(minha_parte) as renda
  from lanc where tipo = 'Renda'
  group by competencia
)
select o.competencia, o.renda_base, o.reserva, o.meta, o.teto_parcelas,
       coalesce(r.renda, 0) as renda_lancada,
       coalesce(s.gasto, 0) as sem_grupo,
       g.id as grupo_id, g.nome as grupo, g.tipo, g.ordem,
       lim.valor as limite,
       coalesce(x.gasto, 0) as gasto
from orc o
cross join grupos g
left join gastos x    on x.competencia = o.competencia and x.grupo_id = g.id
left join sem_grupo s on s.competencia = o.competencia
left join renda r     on r.competencia = o.competencia
left join lateral (
  select l.valor from limites l
  where l.grupo_id = g.id and l.inicio <= o.competencia and (l.fim is null or l.fim >= o.competencia)
  order by l.inicio desc limit 1
) lim on true;
