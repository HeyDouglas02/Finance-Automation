-- =====================================================================
-- Finance · 028 · Débitos parcelados na lista de parcelamentos (regra 17)
-- O teto de parcelas já contava os débitos lançados em mais de uma
-- parcela, mas a lista só mostrava parcelas de cartão. Agora mostra os
-- dois. O débito vem descrito como "<compra> (<n> de <total>)".
-- Mesmas colunas: "create or replace" basta.
-- =====================================================================

create or replace view v_parcelamentos with (security_invoker = true) as
with p as (
  select l.competencia, l.origem as cartao, l.categoria, l.status, l.valor, l.minha_parte, l.dividido_com,
         m[1] as descricao, m[2]::int as parcela_num, m[3]::int as parcela_total
  from v_lancamentos l
  cross join lateral regexp_match(l.descricao, '^(.*) (\d+)/(\d+)$') as m
  where l.tipo = 'Parcela' and m is not null

  union all
  select l.competencia, l.origem, l.categoria, l.status, l.valor, l.minha_parte, l.dividido_com,
         m[1], m[2]::int, m[3]::int
  from v_lancamentos l
  cross join lateral regexp_match(l.descricao, '^(.*) \((\d+) de (\d+)\)$') as m
  where l.tipo = 'Débito' and m is not null
)
select competencia, cartao, descricao, categoria, status,
       parcela_num, parcela_total,
       valor, minha_parte, dividido_com,
       parcela_total - parcela_num as parcelas_restantes,
       (parcela_total - parcela_num) * valor as valor_restante,
       (competencia + (parcela_total - parcela_num) * interval '1 month')::date as ultima_competencia
from p;
