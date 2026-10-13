-- =====================================================================
-- Finance · 009 · v_parcelamentos por mês
-- Antes: só a última parcela real de cada compra (sem uso no app).
-- Agora: cada parcela do mês (real ou prevista), com a sua parte,
-- quanto ainda falta e o mês da última. Parte de v_lancamentos, que
-- monta a descrição como "<compra> <n>/<total>".
-- =====================================================================

drop view v_parcelamentos;

create view v_parcelamentos with (security_invoker = true) as
with p as (
  select l.competencia, l.origem as cartao, l.categoria, l.status, l.valor, l.minha_parte, l.dividido_com,
         m[1] as descricao, m[2]::int as parcela_num, m[3]::int as parcela_total
  from v_lancamentos l
  cross join lateral regexp_match(l.descricao, '^(.*) (\d+)/(\d+)$') as m
  where l.tipo = 'Parcela' and m is not null
)
select competencia, cartao, descricao, categoria, status,
       parcela_num, parcela_total,
       valor, minha_parte, dividido_com,
       parcela_total - parcela_num as parcelas_restantes,
       (parcela_total - parcela_num) * valor as valor_restante,
       (competencia + (parcela_total - parcela_num) * interval '1 month')::date as ultima_competencia
from p;


grant select on v_parcelamentos to authenticated;
