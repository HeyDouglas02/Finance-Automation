-- =====================================================================
-- Finance · 006 · Views usadas pelo app
-- Todas partem de v_lancamentos / transacoes e respeitam o RLS
-- (security_invoker): só o dono enxerga.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_categorias_mes: a sua parte gasta em cada categoria, por mês
-- ---------------------------------------------------------------------
create view v_categorias_mes with (security_invoker = true) as
select competencia,
       coalesce(categoria, 'Sem categoria') as categoria,
       sum(minha_parte) as total,
       count(*) as itens
from v_lancamentos
where tipo <> 'Renda' and minha_parte <> 0
group by competencia, coalesce(categoria, 'Sem categoria');


-- ---------------------------------------------------------------------
-- v_parcelamentos: compras parceladas, a partir da última parcela real
--   ativo = ainda faltam parcelas
-- ---------------------------------------------------------------------
create view v_parcelamentos with (security_invoker = true) as
with grupos as (
  select t.*,
         t.cartao_id || '|' || upper(regexp_replace(t.descricao, '\s+', ' ', 'g')) || '|' ||
         t.parcela_total || '|' || coalesce(to_char(date_trunc('month', t.compra_original), 'YYYY-MM'), '') as grupo
  from transacoes t
  where t.tipo = 'gasto' and t.parcela_total is not null
),
ultima as (
  select distinct on (grupo) * from grupos order by grupo, parcela_num desc
)
select u.id as ultima_transacao_id,
       u.descricao,
       c.nome as cartao,
       u.valor as valor_parcela,
       u.parcela_num,
       u.parcela_total,
       u.parcela_total - u.parcela_num as parcelas_restantes,
       (u.parcela_total - u.parcela_num) * u.valor as valor_restante,
       u.parcela_total * u.valor as valor_total,
       (u.competencia + (u.parcela_total - u.parcela_num) * interval '1 month')::date as ultima_competencia,
       u.parcela_num < u.parcela_total as ativo,
       cat.nome as categoria,
       (select string_agg(p.nome, ', ' order by p.nome)
          from rateios r join pessoas p on p.id = r.pessoa_id
         where r.transacao_id = u.id) as dividido_com
from ultima u
join cartoes c on c.id = u.cartao_id
left join categorias cat on cat.id = u.categoria_id;


-- ---------------------------------------------------------------------
-- v_ritmo: a sua parte acumulada dia a dia (só gastos reais com data)
-- ---------------------------------------------------------------------
create view v_ritmo with (security_invoker = true) as
with por_dia as (
  select competencia, data, sum(minha_parte) as gasto_dia
  from v_lancamentos
  where tipo <> 'Renda' and status = 'Real' and data is not null
  group by competencia, data
)
select competencia, data, gasto_dia,
       sum(gasto_dia) over (partition by competencia order by data) as acumulado
from por_dia;


grant select on v_categorias_mes, v_parcelamentos, v_ritmo to authenticated;
