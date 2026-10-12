-- =====================================================================
-- Finance · 001 · Tabelas, segurança e cadastros básicos
-- Aplicada com: supabase db push
-- Convenção: todo "mês do orçamento" é guardado como o 1º dia do mês (date).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CADASTROS
-- ---------------------------------------------------------------------

create table pessoas (
  id          smallserial primary key,
  nome        text not null unique,          -- Pai, Mãe, Duda, Loja ("Eu" é implícito: o que sobra)
  padrao_pix  text                           -- texto que aparece no Pix de quem paga (ex.: JOEZER)
);

create table categorias (
  id    smallserial primary key,
  nome  text not null unique
);

create table cartoes (
  id                 smallserial primary key,
  nome               text not null unique,   -- VISA PLATINUM, ELO GRAFITE, GOLD, Meu Carrefour, Pai
  conectado          boolean not null default true,   -- true = vem do banco pela Pluggy
  pluggy_account_id  text unique,
  dia_fechamento     smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento     smallint not null check (dia_vencimento between 1 and 31),
  meses_ate_vencer   smallint not null default 1 check (meses_ate_vencer between 0 and 3)
);

create table regras_categoria (
  id              serial primary key,
  texto           text not null,             -- trecho que a descrição da compra contém
  categoria_id    smallint not null references categorias,
  divisao_padrao  jsonb,                     -- ex.: [{"pessoa":"Pai","valor":875},{"pessoa":"Mãe","valor":199.65}]
  prioridade      int not null default 100   -- menor = testada antes
);

create table contas_fixas (
  id            serial primary key,
  nome          text not null,
  valor         numeric(12,2) not null check (valor > 0),
  forma         text not null check (forma in ('debito', 'credito')),
  inicio        date not null check (extract(day from inicio) = 1),
  fim           date check (fim is null or (extract(day from fim) = 1 and fim >= inicio)),
  texto_fatura  text                         -- como aparece na fatura (só crédito)
);

-- ---------------------------------------------------------------------
-- 2. DADOS DO BANCO (preenchidos pela sincronização com a Pluggy)
-- ---------------------------------------------------------------------

create table faturas (
  id             text primary key,           -- id da fatura na Pluggy
  cartao_id      smallint not null references cartoes,
  vencimento     date not null,
  total          numeric(12,2) not null,
  encargos       numeric(12,2) not null default 0,
  atualizado_em  timestamptz not null default now()
);

create table transacoes (
  id               text primary key,         -- id da transação na Pluggy
  cartao_id        smallint not null references cartoes,
  data             date not null,
  descricao        text not null,
  valor            numeric(12,2) not null,   -- compra positiva, estorno negativo
  status           text not null check (status in ('POSTED', 'PENDING')),
  tipo             text not null default 'gasto' check (tipo in ('gasto', 'ignorado')),
  parcela_num      smallint,
  parcela_total    smallint,
  compra_original  date,
  fatura_id        text,                     -- id da fatura na Pluggy (pode chegar antes da fatura)
  cartao_final     text,                     -- final do cartão usado (físico ou virtual)
  competencia      date not null check (extract(day from competencia) = 1),
  categoria_id     smallint references categorias,
  revisado         boolean not null default false,
  observacao       text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check ((parcela_num is null) = (parcela_total is null))
);
create index transacoes_competencia_idx on transacoes (competencia);
create index transacoes_pendentes_idx   on transacoes (data desc) where not revisado and tipo = 'gasto';
create index transacoes_parcelas_idx    on transacoes (cartao_id, descricao, parcela_total) where parcela_total is not null;

create table conexoes (
  item_id             text primary key,      -- item da Pluggy (uma conexão por banco)
  contas              text not null,
  status              text,
  execucao            text,
  ultima_atualizacao  timestamptz,
  avisos              text,
  sincronizado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. LANÇAMENTOS MANUAIS
-- ---------------------------------------------------------------------

create table renda (
  id           serial primary key,
  competencia  date not null check (extract(day from competencia) = 1),
  fonte        text not null,
  valor        numeric(12,2) not null check (valor > 0)
);

create table debitos (
  id                  serial primary key,
  competencia_inicio  date not null check (extract(day from competencia_inicio) = 1),
  descricao           text not null,
  valor               numeric(12,2) not null,          -- valor de cada parcela (negativo = ajuste)
  parcelas            smallint not null default 1 check (parcelas >= 1),
  categoria_id        smallint references categorias
);

create table abastecimentos (
  id         serial primary key,
  data       date not null,
  valor      numeric(12,2) not null check (valor > 0),
  cartao_id  smallint not null references cartoes
);

create table pagamentos (
  id           serial primary key,
  competencia  date not null check (extract(day from competencia) = 1),  -- mês que está sendo pago
  pessoa_id    smallint not null references pessoas,
  valor        numeric(12,2) not null check (valor > 0),
  data         date not null default current_date
);

-- ---------------------------------------------------------------------
-- 4. RATEIOS: a parte de cada pessoa em uma compra, débito ou abastecimento
--    Compra inteira de alguém = uma linha com percentual 100.
--    O que não estiver em rateio é seu.
-- ---------------------------------------------------------------------

create table rateios (
  id                serial primary key,
  transacao_id      text references transacoes on delete cascade,
  debito_id         int  references debitos on delete cascade,
  abastecimento_id  int  references abastecimentos on delete cascade,
  pessoa_id         smallint not null references pessoas,
  valor             numeric(12,2),           -- parte fixa (ex.: Mãe 100)
  percentual        numeric(5,2) check (percentual > 0 and percentual <= 100),   -- ou % (ex.: Duda 50)
  check (num_nonnulls(transacao_id, debito_id, abastecimento_id) = 1),
  check (num_nonnulls(valor, percentual) = 1)
);
create index rateios_transacao_idx on rateios (transacao_id);
create index rateios_debito_idx on rateios (debito_id);
create index rateios_abastecimento_idx on rateios (abastecimento_id);

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA: RLS ligado em tudo; só usuário logado acessa.
--    (A sincronização usa a chave de serviço, que não passa pelo RLS.)
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['pessoas','categorias','cartoes','regras_categoria','contas_fixas',
                           'faturas','transacoes','conexoes','renda','debitos','abastecimentos',
                           'pagamentos','rateios'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "apenas usuario logado" on %I for all to authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- ---------------------------------------------------------------------
-- 6. CATEGORIAS PADRÃO (dados pessoais ficam em supabase/local/, fora do Git)
-- ---------------------------------------------------------------------

insert into categorias (nome) values
  ('Mercado'), ('Necessidades'), ('Eletrônicos'), ('Assinaturas'), ('Roupa'), ('Beleza'),
  ('Presentes'), ('Saúde'), ('Despesas eventuais'), ('Desenvolvimento'), ('Uber/transporte'),
  ('IFood/restaurante'), ('Lazer'), ('Aluguel'), ('Contas'), ('Taxas'), ('Faculdade'),
  ('Conta fixa'), ('Gasolina'), ('A revisar');
