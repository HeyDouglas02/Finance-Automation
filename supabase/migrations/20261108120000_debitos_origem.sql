-- =====================================================================
-- Finance · 027 · Débitos que vieram de outra pessoa (regra 18)
--
-- debitos.origem: nome de quem pagou por mim (ex.: compras no cartão do
-- Douglas que são minhas). No orçamento cada débito continua separado,
-- na sua categoria; no fechamento, os débitos da mesma origem viram uma
-- saída só por mês ("Pagar Douglas"), com um Paguei só.
-- Vazio = débito comum, como antes.
-- =====================================================================

alter table debitos
  add column origem text check (origem is null or length(trim(origem)) > 0);


create or replace view v_fechamento with (security_invoker = true) as
with linhas as (
  -- renda
  select i.competencia, 'Entrada' as lado, i.ref, i.descricao, i.valor, null::date as vencimento, null::smallint as pessoa_id
  from v_itens i
  where i.tipo = 'Renda'

  union all
  -- acerto de cada pessoa (o Recebi vem de pagamentos)
  select a.competencia, 'Entrada', 'acerto:' || p.id || ':' || to_char(a.competencia, 'YYYY-MM'),
         a.pessoa, a.devido, null, p.id
  from v_acertos a
  join pessoas p on p.nome = a.pessoa
  where a.devido > 0.009

  union all
  -- fatura dos cartões conectados (fechada = total do banco; aberta = estimativa)
  select f.competencia, 'Saída', 'fatura:' || c.id || ':' || to_char(f.competencia, 'YYYY-MM'),
         c.nome, f.total, f.vencimento, null
  from v_faturas_mes f
  join cartoes c on c.nome = f.cartao
  where f.total > 0.009

  union all
  -- fatura dos cartões não conectados (gasolina anotada à mão, regra 7)
  select i.competencia, 'Saída', 'fatura:' || c.id || ':' || to_char(i.competencia, 'YYYY-MM'),
         c.nome, sum(i.valor),
         ((i.competencia + interval '1 month')::date + c.dia_vencimento - 1), null
  from v_itens i
  join cartoes c on c.nome = i.origem
  where i.tipo = 'Gasolina'
  group by i.competencia, c.id, c.nome, c.dia_vencimento

  union all
  -- contas fixas no débito e débitos lançados (sem origem)
  select i.competencia, 'Saída', i.ref, i.descricao, i.valor, null, null
  from v_itens i
  left join debitos d on d.id = i.src_debito
  where (i.tipo = 'Conta fixa' and i.status = 'Esperado') or (i.tipo = 'Débito' and d.origem is null)

  union all
  -- débitos de outra pessoa: uma saída por origem e mês
  select i.competencia, 'Saída', 'origem:' || d.origem || ':' || to_char(i.competencia, 'YYYY-MM'),
         'Pagar ' || d.origem, sum(i.valor), null, null
  from v_itens i
  join debitos d on d.id = i.src_debito
  where i.tipo = 'Débito' and d.origem is not null
  group by i.competencia, d.origem
)
select l.competencia, l.lado, l.ref, l.descricao, l.valor, l.vencimento, l.pessoa_id,
       case when l.pessoa_id is not null
            then coalesce(a.situacao = 'Pago', false)
            else b.ref is not null end as marcado,
       case when l.pessoa_id is not null then a.ultimo_pagamento else b.data end as marcado_em
from linhas l
left join baixas b on b.ref = l.ref
left join pessoas p on p.id = l.pessoa_id
left join v_acertos a on a.competencia = l.competencia and a.pessoa = p.nome;
