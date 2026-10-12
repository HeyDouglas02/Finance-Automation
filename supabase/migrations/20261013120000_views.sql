-- =====================================================================
-- Finance · 002 · Views: lançamentos, partes por pessoa, mês e acertos
-- Regras em docs/regras-de-negocio.md. Nada aqui grava dados: as views
-- calculam tudo na hora, a partir das tabelas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- v_itens: tudo que entra no orçamento, um registro por valor e por mês.
--   status: Real (veio do banco) · Previsto (ainda não cobrado)
--           Esperado (conta fixa no débito) · Manual (lançado à mão)
--   src_*: de onde vêm os rateios (quem divide o valor)
-- ---------------------------------------------------------------------
create view v_itens with (security_invoker = true) as
with
tx as (
  select t.*, c.nome as cartao, cat.nome as categoria,
         -- grupo de parcelas da mesma compra (o banco às vezes varia a data em 1 dia)
         case when t.parcela_total is not null then
           t.cartao_id || '|' || upper(regexp_replace(t.descricao, '\s+', ' ', 'g')) || '|' ||
           t.parcela_total || '|' || coalesce(to_char(date_trunc('month', t.compra_original), 'YYYY-MM'), '')
         end as grupo
  from transacoes t
  join cartoes c on c.id = t.cartao_id
  left join categorias cat on cat.id = t.categoria_id
  where t.tipo = 'gasto'
),
-- conta fixa cobrada no cartão → qual conta da lista ela é (texto + valor mais próximo)
tx_fixa as (
  select tx.id, f.id as fixa_id, f.valor as esperado
  from tx
  cross join lateral (
    select f.id, f.valor from contas_fixas f
    where f.forma = 'credito' and f.texto_fatura is not null
      and upper(tx.descricao) like '%' || upper(f.texto_fatura) || '%'
      and tx.competencia >= f.inicio and (f.fim is null or tx.competencia <= f.fim)
    order by abs(f.valor - tx.valor) limit 1
  ) f
  where tx.categoria = 'Conta fixa'
),
reais as (
  select tx.*,
         lag(tx.valor) over (partition by tx.grupo order by tx.parcela_num) as valor_parcela_anterior
  from tx
),
ultima_parcela as (
  select distinct on (grupo) * from tx
  where grupo is not null
  order by grupo, parcela_num desc
),
meses_futuros as (
  select date_trunc('month', current_date)::date + interval '12 months' as ate
)

-- 1) compras, parcelas e contas fixas cobradas no cartão (reais)
select 'tx:' || r.id as ref, r.competencia,
       case when r.categoria = 'Conta fixa' then 'Conta fixa'
            when r.parcela_total is not null then 'Parcela' else 'Cartão' end as tipo,
       r.descricao || coalesce(' ' || r.parcela_num || '/' || r.parcela_total, '') as descricao,
       r.valor, r.categoria, 'Real' as status,
       case
         when tf.esperado is not null and abs(tf.esperado - r.valor) >= 0.01
           then 'Esperado ' || to_char(tf.esperado, 'FM999G990D00')
         when r.grupo is not null and r.valor_parcela_anterior is not null
              and abs(r.valor_parcela_anterior - r.valor) > 0.05
           then 'Parcela anterior ' || to_char(r.valor_parcela_anterior, 'FM999G990D00')
       end as divergencia,
       r.cartao as origem, r.data,
       r.id as src_transacao, null::int as src_debito, null::int as src_abastecimento
from reais r
left join tx_fixa tf on tf.id = r.id

union all
-- 2) parcelas futuras previstas, a partir da última parcela conhecida (herdam os rateios dela)
select 'prev:' || u.id || ':' || k, (u.competencia + (k - u.parcela_num) * interval '1 month')::date,
       'Parcela', u.descricao || ' ' || k || '/' || u.parcela_total,
       u.valor, u.categoria, 'Previsto', null,
       u.cartao, (u.data + (k - u.parcela_num) * interval '1 month')::date,
       u.id, null, null
from ultima_parcela u
cross join lateral generate_series(u.parcela_num + 1, u.parcela_total) as k

union all
-- 3) contas fixas: previstas (crédito ainda não cobrado) ou esperadas (débito)
select 'fixa:' || f.id || ':' || to_char(m, 'YYYY-MM'), m::date,
       'Conta fixa', f.nome, f.valor, 'Conta fixa',
       case f.forma when 'credito' then 'Previsto' else 'Esperado' end, null,
       'Contas fixas', null, null, null, null
from contas_fixas f
cross join meses_futuros mf
cross join lateral generate_series(f.inicio, coalesce(f.fim, mf.ate), interval '1 month') as m
where f.forma = 'debito'
   or not exists (select 1 from tx_fixa tf join transacoes t on t.id = tf.id
                  where tf.fixa_id = f.id and t.competencia = m::date)

union all
-- 4) débitos (avulsos ou parcelados: um lançamento por mês)
select 'deb:' || d.id || ':' || k, (d.competencia_inicio + k * interval '1 month')::date,
       'Débito', d.descricao || case when d.parcelas > 1 then ' (' || (k + 1) || ' de ' || d.parcelas || ')' else '' end,
       d.valor, cat.nome, 'Manual', null, 'Débito', null,
       null, d.id, null
from debitos d
left join categorias cat on cat.id = d.categoria_id
cross join lateral generate_series(0, d.parcelas - 1) as k

union all
-- 5) gasolina: conta no mês anterior ao vencimento do cartão
select 'gas:' || a.id,
       (date_trunc('month', a.data)
         + ((case when extract(day from a.data) <= c.dia_fechamento then 0 else 1 end)
            + c.meses_ate_vencer - 1) * interval '1 month')::date,
       'Gasolina', 'Gasolina ' || c.nome, a.valor, 'Gasolina', 'Manual', null,
       c.nome, a.data, null, null, a.id
from abastecimentos a
join cartoes c on c.id = a.cartao_id

union all
-- 6) renda
select 'renda:' || r.id, r.competencia, 'Renda', r.fonte, r.valor, 'Renda', 'Manual', null,
       'Renda', null, null, null, null
from renda r;


-- ---------------------------------------------------------------------
-- v_partes: a parte de cada pessoa em cada item (rateio por valor ou %)
-- ---------------------------------------------------------------------
create view v_partes with (security_invoker = true) as
select i.ref, i.competencia, i.tipo, i.descricao, i.status, p.nome as pessoa,
       coalesce(r.valor, round(i.valor * r.percentual / 100, 2)) as valor
from v_itens i
join rateios r on r.transacao_id = i.src_transacao
join pessoas p on p.id = r.pessoa_id
union all
select i.ref, i.competencia, i.tipo, i.descricao, i.status, p.nome,
       coalesce(r.valor, round(i.valor * r.percentual / 100, 2))
from v_itens i
join rateios r on r.debito_id = i.src_debito
join pessoas p on p.id = r.pessoa_id
union all
select i.ref, i.competencia, i.tipo, i.descricao, i.status, p.nome,
       coalesce(r.valor, round(i.valor * r.percentual / 100, 2))
from v_itens i
join rateios r on r.abastecimento_id = i.src_abastecimento
join pessoas p on p.id = r.pessoa_id;


-- ---------------------------------------------------------------------
-- v_lancamentos: itens + a sua parte (o que sobra depois dos rateios)
-- ---------------------------------------------------------------------
create view v_lancamentos with (security_invoker = true) as
select i.ref, i.competencia, i.tipo, i.descricao, i.valor,
       case when i.tipo = 'Renda' then i.valor
            else i.valor - coalesce(pt.total, 0) end as minha_parte,
       pt.quem as dividido_com,
       i.categoria, i.status, i.divergencia, i.origem, i.data
from v_itens i
left join (
  select ref, sum(valor) as total,
         string_agg(pessoa || ' ' || to_char(valor, 'FM999G990D00'), ', ' order by pessoa) as quem
  from v_partes group by ref
) pt on pt.ref = i.ref;


-- ---------------------------------------------------------------------
-- v_mes: a "fatura" de cada mês — renda, saídas por grupo e sobra
-- ---------------------------------------------------------------------
create view v_mes with (security_invoker = true) as
select competencia,
       sum(minha_parte) filter (where tipo = 'Renda')      as renda,
       sum(minha_parte) filter (where tipo = 'Conta fixa') as contas_fixas,
       sum(minha_parte) filter (where tipo = 'Parcela')    as parcelas,
       sum(minha_parte) filter (where tipo = 'Cartão')     as cartao,
       sum(minha_parte) filter (where tipo = 'Débito')     as debito,
       sum(minha_parte) filter (where tipo = 'Gasolina')   as gasolina,
       coalesce(sum(minha_parte) filter (where tipo <> 'Renda'), 0) as saidas,
       coalesce(sum(minha_parte) filter (where tipo = 'Renda'), 0)
         - coalesce(sum(minha_parte) filter (where tipo <> 'Renda'), 0) as sobra
from v_lancamentos
group by competencia;


-- ---------------------------------------------------------------------
-- v_acertos: quanto cada pessoa deve em cada mês e quanto já pagou
-- ---------------------------------------------------------------------
create view v_acertos with (security_invoker = true) as
with devido as (
  select competencia, pessoa, sum(valor) as devido, count(*) as itens
  from v_partes group by competencia, pessoa
),
pago as (
  select pg.competencia, p.nome as pessoa, sum(pg.valor) as pago, max(pg.data) as ultimo_pagamento
  from pagamentos pg join pessoas p on p.id = pg.pessoa_id
  group by pg.competencia, p.nome
)
select coalesce(d.competencia, g.competencia) as competencia,
       coalesce(d.pessoa, g.pessoa) as pessoa,
       coalesce(d.devido, 0) as devido,
       coalesce(g.pago, 0) as pago,
       coalesce(d.devido, 0) - coalesce(g.pago, 0) as falta,
       coalesce(d.itens, 0) as itens,
       g.ultimo_pagamento,
       case when coalesce(g.pago, 0) >= coalesce(d.devido, 0) - 0.01 then 'Pago' else 'Pendente' end as situacao
from devido d
full join pago g on g.competencia = d.competencia and g.pessoa = d.pessoa;


-- ---------------------------------------------------------------------
-- Acesso: só usuário logado (o RLS das tabelas vale dentro das views)
-- ---------------------------------------------------------------------
grant select on v_itens, v_partes, v_lancamentos, v_mes, v_acertos to authenticated;
