-- =====================================================================
-- Finance · 018 · Orçamento: grupos, limites em reais, reserva, meta e teto
-- Regras 12 a 17 (docs/regras-de-negocio.md), decisão 013.
--
-- 1. grupos: o que tem limite, o que é reserva, fixo ou sem limite
-- 2. categorias passam a ser o detalhe de um grupo; as sobrepostas se juntam
-- 3. "A revisar" deixa de ser categoria: pendente é transação sem categoria
-- 4. regras_categoria.valor: regra que só vale para um valor (ex.: apple.com)
-- 5. limites e orcamento, com vigência (como as contas fixas)
-- 6. views: v_orcamento_base → v_orcamento_mes → v_orcamento_grupos
--
-- categorias.limite_percentual (regra 12 antiga) continua até o app novo
-- subir; sai numa migration seguinte.
-- Os valores reais (renda base, limites...) não ficam no Git: são
-- inseridos à mão, no SQL Editor, depois desta migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. GRUPOS
-- ---------------------------------------------------------------------
create table grupos (
  id     smallserial primary key,
  nome   text not null unique,
  tipo   text not null check (tipo in ('limite', 'reserva', 'fixo', 'sem_limite')),
  ordem  smallint not null
);

insert into grupos (nome, tipo, ordem) values
  ('Mercado', 'limite', 1), ('Comer fora', 'limite', 2), ('Lazer', 'limite', 3),
  ('Compras', 'limite', 4), ('Transporte', 'limite', 5),
  ('Fixos', 'fixo', 6),
  ('Saúde', 'reserva', 7), ('Imprevistos', 'reserva', 8),
  ('Taxas', 'sem_limite', 9);

-- ---------------------------------------------------------------------
-- 2. CATEGORIAS: renomeia, junta as sobrepostas e liga cada uma ao grupo
--    "Conta fixa", "Gasolina" e "Taxas" mantêm o nome (as views usam).
-- ---------------------------------------------------------------------
update categorias set nome = 'Comer fora'  where nome = 'IFood/restaurante';
update categorias set nome = 'Uber/ônibus' where nome = 'Uber/transporte';
update categorias set nome = 'Imprevistos' where nome = 'Despesas eventuais';
insert into categorias (nome) values ('Outros') on conflict (nome) do nothing;

do $$
declare
  par  text[];
  de   smallint;
  para smallint;
begin
  foreach par slice 1 in array array[
    ['Contas', 'Conta fixa'], ['Assinaturas', 'Conta fixa'],
    ['Aluguel', 'Conta fixa'], ['Faculdade', 'Conta fixa'],
    ['Necessidades', 'Saúde'],
    ['Beleza', 'Outros'], ['Desenvolvimento', 'Outros']
  ] loop
    select id into de   from categorias where nome = par[1];
    select id into para from categorias where nome = par[2];
    continue when de is null;
    update transacoes       set categoria_id = para where categoria_id = de;
    update debitos          set categoria_id = para where categoria_id = de;
    update regras_categoria set categoria_id = para where categoria_id = de;
    delete from categorias where id = de;
  end loop;
end $$;

-- "A revisar" era um marcador de pendente, não uma categoria (regra 11)
update transacoes set categoria_id = null where categoria_id = (select id from categorias where nome = 'A revisar');
update debitos    set categoria_id = null where categoria_id = (select id from categorias where nome = 'A revisar');
delete from regras_categoria where categoria_id = (select id from categorias where nome = 'A revisar');
delete from categorias where nome = 'A revisar';

alter table categorias add column grupo_id smallint references grupos;

update categorias c set grupo_id = g.id
from (values
  ('Mercado', 'Mercado'), ('Comer fora', 'Comer fora'), ('Lazer', 'Lazer'),
  ('Roupa', 'Compras'), ('Eletrônicos', 'Compras'), ('Presentes', 'Compras'), ('Outros', 'Compras'),
  ('Gasolina', 'Transporte'), ('Uber/ônibus', 'Transporte'),
  ('Conta fixa', 'Fixos'), ('Saúde', 'Saúde'), ('Imprevistos', 'Imprevistos'), ('Taxas', 'Taxas')
) v(categoria, grupo)
join grupos g on g.nome = v.grupo
where c.nome = v.categoria;

do $$
declare sobra text;
begin
  select string_agg(nome, ', ') into sobra from categorias where grupo_id is null;
  if sobra is not null then
    raise exception 'Categorias sem grupo: %. Inclua no de-para antes de rodar.', sobra;
  end if;
end $$;

alter table categorias alter column grupo_id set not null;

-- ---------------------------------------------------------------------
-- 3. REGRA COM VALOR: o mesmo texto pode ser assinatura ou compra avulsa
-- ---------------------------------------------------------------------
alter table regras_categoria
  add column valor numeric(12,2);   -- preenchido: a regra só vale para compras com esse valor

-- ---------------------------------------------------------------------
-- 4. LIMITES E ORÇAMENTO (vigência: vale do início até o fim, ou até mudar)
-- ---------------------------------------------------------------------
create table limites (
  id        serial primary key,
  grupo_id  smallint not null references grupos,
  valor     numeric(12,2) not null check (valor > 0),
  inicio    date not null check (extract(day from inicio) = 1),
  fim       date check (fim is null or (extract(day from fim) = 1 and fim >= inicio))
);

create table orcamento (
  id             serial primary key,
  inicio         date not null check (extract(day from inicio) = 1),
  fim            date check (fim is null or (extract(day from fim) = 1 and fim >= inicio)),
  renda_base     numeric(12,2) not null check (renda_base > 0),
  reserva        numeric(12,2) not null default 0 check (reserva >= 0),   -- Saúde + Imprevistos
  meta           numeric(12,2) not null default 0 check (meta >= 0),      -- alvo do saldo do mês
  teto_parcelas  numeric(12,2) check (teto_parcelas > 0)                  -- vazio = sem teto
);

do $$
declare t text;
begin
  foreach t in array array['grupos', 'limites', 'orcamento'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "somente o dono" on %I for all to authenticated
                    using ((select private.eh_dono())) with check ((select private.eh_dono()))', t);
  end loop;
end $$;

grant select on grupos to authenticated;
grant select, insert, update, delete on limites, orcamento to authenticated;
grant usage, select on sequence limites_id_seq, orcamento_id_seq to authenticated;

-- ---------------------------------------------------------------------
-- 5. FUNÇÕES: pendente não é mais uma categoria, então basta exigir uma
-- ---------------------------------------------------------------------
create or replace function public.classificar(p_transacao text, p_categoria smallint, p_rateios jsonb default '[]')
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  t      transacoes%rowtype;
  alvos  text[];
  partes numeric;
begin
  select * into t from transacoes where id = p_transacao;
  if not found then
    raise exception 'Compra não encontrada';
  end if;

  if p_categoria is null then
    raise exception 'Escolha uma categoria';
  end if;

  if jsonb_typeof(p_rateios) <> 'array' then
    raise exception 'Divisão inválida';
  end if;

  if (select count(*) <> count(distinct r->>'pessoa_id') from jsonb_array_elements(p_rateios) r) then
    raise exception 'A mesma pessoa aparece duas vezes na divisão';
  end if;

  -- parte dos outros (valor fixo + %) não pode passar do valor da compra
  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(t.valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(t.valor) + 0.005 then
    raise exception 'A divisão passa do valor da compra';
  end if;

  alvos := array[t.id];
  if t.parcela_total is not null then
    select array_agg(x.id) into alvos
    from transacoes x
    where x.tipo = 'gasto'
      and x.cartao_id = t.cartao_id
      and x.parcela_total = t.parcela_total
      and upper(regexp_replace(x.descricao, '\s+', ' ', 'g')) = upper(regexp_replace(t.descricao, '\s+', ' ', 'g'))
      and coalesce(to_char(date_trunc('month', x.compra_original), 'YYYY-MM'), '')
        = coalesce(to_char(date_trunc('month', t.compra_original), 'YYYY-MM'), '')
      and x.parcela_num >= t.parcela_num;
  end if;

  update transacoes
     set categoria_id = p_categoria, revisado = true, atualizado_em = now()
   where id = any(alvos);

  delete from rateios where transacao_id = any(alvos);

  insert into rateios (transacao_id, pessoa_id, valor, percentual)
  select a, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from unnest(alvos) a
  cross join jsonb_array_elements(p_rateios) r;

  return array_length(alvos, 1);
end;
$$;

create or replace function public.lancar_debito(
  p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]')
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  novo   int;
  partes numeric;
begin
  if p_categoria is null then
    raise exception 'Escolha uma categoria';
  end if;

  if jsonb_typeof(p_rateios) <> 'array' then
    raise exception 'Divisão inválida';
  end if;

  if (select count(*) <> count(distinct r->>'pessoa_id') from jsonb_array_elements(p_rateios) r) then
    raise exception 'A mesma pessoa aparece duas vezes na divisão';
  end if;

  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(p_valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(p_valor) + 0.005 then
    raise exception 'A divisão passa do valor';
  end if;

  insert into debitos (competencia_inicio, descricao, valor, parcelas, categoria_id)
  values (date_trunc('month', p_competencia)::date, trim(p_descricao), p_valor, p_parcelas, p_categoria)
  returning id into novo;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select novo, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;

  return novo;
end;
$$;

create or replace function public.editar_debito(
  p_debito int, p_competencia date, p_descricao text, p_valor numeric, p_parcelas smallint,
  p_categoria smallint, p_rateios jsonb default '[]')
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  partes numeric;
begin
  if not exists (select 1 from debitos where id = p_debito) then
    raise exception 'Débito não encontrado';
  end if;

  if p_categoria is null then
    raise exception 'Escolha uma categoria';
  end if;

  if jsonb_typeof(p_rateios) <> 'array' then
    raise exception 'Divisão inválida';
  end if;

  if (select count(*) <> count(distinct r->>'pessoa_id') from jsonb_array_elements(p_rateios) r) then
    raise exception 'A mesma pessoa aparece duas vezes na divisão';
  end if;

  select coalesce(sum(coalesce((r->>'valor')::numeric, abs(p_valor) * (r->>'percentual')::numeric / 100)), 0)
    into partes
  from jsonb_array_elements(p_rateios) r;
  if partes > abs(p_valor) + 0.005 then
    raise exception 'A divisão passa do valor';
  end if;

  update debitos
     set competencia_inicio = date_trunc('month', p_competencia)::date, descricao = trim(p_descricao),
         valor = p_valor, parcelas = p_parcelas, categoria_id = p_categoria
   where id = p_debito;

  delete from rateios where debito_id = p_debito;

  insert into rateios (debito_id, pessoa_id, valor, percentual)
  select p_debito, (r->>'pessoa_id')::smallint, (r->>'valor')::numeric, (r->>'percentual')::numeric
  from jsonb_array_elements(p_rateios) r;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. VIEWS
-- ---------------------------------------------------------------------

-- v_categorias_mes ganha o grupo (coluna nova no fim: "create or replace" basta)
create or replace view v_categorias_mes with (security_invoker = true) as
select l.competencia,
       coalesce(l.categoria, 'Sem categoria') as categoria,
       sum(l.minha_parte) as total,
       count(*) as itens,
       g.nome as grupo
from v_lancamentos l
left join categorias c on c.nome = l.categoria
left join grupos g on g.id = c.grupo_id
where l.tipo <> 'Renda' and l.minha_parte <> 0
group by l.competencia, coalesce(l.categoria, 'Sem categoria'), g.nome;

-- v_orcamento_base: cada mês com orçamento × cada grupo, com limite e gasto (sua parte)
create view v_orcamento_base with (security_invoker = true) as
with
meses as (
  select distinct competencia from v_lancamentos
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
itens as (
  select l.competencia, l.minha_parte, c.grupo_id
  from v_lancamentos l
  left join categorias c on c.nome = l.categoria
  where l.tipo <> 'Renda'
),
gastos as (
  select competencia, grupo_id, sum(minha_parte) as gasto
  from itens where grupo_id is not null
  group by competencia, grupo_id
),
sem_grupo as (   -- pendentes (sem categoria): saem do saldo, mas não têm grupo
  select competencia, sum(minha_parte) as gasto
  from itens where grupo_id is null
  group by competencia
),
renda as (
  select competencia, sum(minha_parte) as renda
  from v_lancamentos where tipo = 'Renda'
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

-- v_orcamento_mes: o mês inteiro (regras 13 a 17)
--   folga: renda − meta − fixos − reserva (ou o gasto, se passou) − sem limite
--          − limites (ou o gasto, se passou). Negativa = o que passou
--          precisa sair do que ainda resta nos limites (corte).
create view v_orcamento_mes with (security_invoker = true) as
with
mes as (
  select competencia,
         max(renda_base) as renda_base, max(reserva) as reserva, max(meta) as meta,
         max(teto_parcelas) as teto_parcelas, max(renda_lancada) as renda_lancada,
         max(sem_grupo) as sem_grupo,
         coalesce(sum(gasto) filter (where tipo = 'fixo'), 0)       as fixos,
         coalesce(sum(gasto) filter (where tipo = 'reserva'), 0)    as reserva_gasto,
         coalesce(sum(gasto) filter (where tipo = 'sem_limite'), 0) as sem_limite,
         coalesce(sum(limite) filter (where tipo = 'limite'), 0)    as limites,
         coalesce(sum(gasto) filter (where tipo = 'limite'), 0)     as gasto_limites,
         coalesce(sum(greatest(gasto, coalesce(limite, gasto))) filter (where tipo = 'limite'), 0) as limites_usados,
         coalesce(sum(greatest(limite - gasto, 0)) filter (where tipo = 'limite'), 0)              as resta_sem_corte
  from v_orcamento_base
  group by competencia
),
-- parcelas: do cartão (reais e previstas) e débitos lançados em mais de uma parcela (regra 17)
parcelas as (
  select l.competencia, sum(l.minha_parte) as parcelas
  from v_lancamentos l
  left join debitos d on l.ref like 'deb:%' and d.id::text = split_part(l.ref, ':', 2)
  where l.tipo = 'Parcela' or (l.tipo = 'Débito' and d.parcelas > 1)
  group by l.competencia
),
calc as (
  select m.*,
         coalesce(p.parcelas, 0) as parcelas,
         -- mês sem renda lançada: vale a renda base (regra 13)
         case when m.renda_lancada > 0 then m.renda_lancada else m.renda_base end as renda
  from mes m
  left join parcelas p on p.competencia = m.competencia
),
folga as (
  select c.*,
         c.renda - c.meta - c.fixos - greatest(c.reserva, c.reserva_gasto)
           - c.sem_limite - c.sem_grupo - c.limites_usados as folga
  from calc c
)
select competencia, renda_base, renda, renda_lancada > 0 as renda_lancada,
       meta, fixos, reserva, reserva_gasto, sem_limite, sem_grupo,
       limites, gasto_limites,
       parcelas, fixos + parcelas as comprometido, teto_parcelas,
       folga,
       least(greatest(-folga, 0), resta_sem_corte)     as corte,          -- sai do que resta nos limites
       resta_sem_corte - least(greatest(-folga, 0), resta_sem_corte) as resta,
       greatest(-folga - resta_sem_corte, 0)            as abaixo_da_meta, -- o corte não coube
       meta + greatest(folga, 0) - greatest(-folga - resta_sem_corte, 0) as saldo_previsto
from folga;

-- v_orcamento_grupos: cada grupo no mês, com o "resta" já descontado do que passou
--   O corte é dividido na proporção do que resta em cada grupo (regra 14).
create view v_orcamento_grupos with (security_invoker = true) as
select b.competencia, b.grupo_id, b.grupo, b.tipo, b.ordem, b.limite, b.gasto,
       case when b.limite is not null then greatest(b.gasto - b.limite, 0) end as excesso,
       case when b.tipo = 'limite' and b.limite is not null then greatest(b.limite - b.gasto, 0) end as resta_sem_corte,
       case when b.tipo = 'limite' and b.limite is not null then
         round(greatest(b.limite - b.gasto, 0)
               * case when m.resta + m.corte > 0 then m.resta / (m.resta + m.corte) else 1 end, 2)
       end as resta
from v_orcamento_base b
join v_orcamento_mes m on m.competencia = b.competencia;

grant select on v_orcamento_base, v_orcamento_mes, v_orcamento_grupos to authenticated;
