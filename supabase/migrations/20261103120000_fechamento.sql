-- =====================================================================
-- Finance · 022 · Fechamento do mês (regra 18)
--
-- baixas: o que já foi marcado como Recebi (renda) ou Paguei (saídas).
--   Uma linha por item marcado; desmarcar apaga a linha. O item é
--   identificado pela ref (a mesma da v_itens; fatura = 'fatura:<cartão>:<mês>').
--   O Recebi dos acertos continua na tabela pagamentos (regra 9).
--
-- v_fechamento: as duas listas do mês, já com o que está marcado.
--   Entradas: renda + acerto de cada pessoa.
--   Saídas:   fatura de cada cartão + contas fixas no débito + débitos,
--             pelo valor cheio (a parte dos outros volta como acerto).
-- =====================================================================

create table baixas (
  ref   text primary key,
  data  date not null default current_date
);

alter table baixas enable row level security;
create policy "somente o dono" on baixas for all to authenticated
  using ((select private.eh_dono())) with check ((select private.eh_dono()));
grant select, insert, delete on baixas to authenticated;


create view v_fechamento with (security_invoker = true) as
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
  -- contas fixas no débito e débitos lançados
  select i.competencia, 'Saída', i.ref, i.descricao, i.valor, null, null
  from v_itens i
  where (i.tipo = 'Conta fixa' and i.status = 'Esperado') or i.tipo = 'Débito'
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

grant select on v_fechamento to authenticated;
