-- Dados FICTÍCIOS para testar o projeto localmente (supabase db reset).
-- Os dados reais nunca entram no repositório.

insert into pessoas (nome, padrao_pix) values
  ('Ana', 'ANA EXEMPLO'),
  ('Bruno', 'BRUNO EXEMPLO'),
  ('Loja', null);

insert into cartoes (nome, conectado, dia_fechamento, dia_vencimento, meses_ate_vencer) values
  ('Cartão A', true, 22, 8, 1),
  ('Cartão B', true, 30, 7, 1),
  ('Cartão Posto', false, 23, 3, 2);

insert into renda (competencia, fonte, valor) values
  ('2026-10-01', 'Salário', 3000.00),
  ('2026-10-01', 'Freela', 450.00);

insert into contas_fixas (nome, valor, forma, inicio, texto_fatura) values
  ('Streaming', 39.90, 'credito', '2026-08-01', 'STREAMING'),
  ('Academia', 99.00, 'debito', '2026-08-01', null);

-- Orçamento (regras 13 a 17)
insert into orcamento (inicio, renda_base, reserva, meta, teto_parcelas) values
  ('2026-10-01', 3000.00, 200.00, 300.00, 400.00);

insert into limites (grupo_id, valor, inicio)
select g.id, v.valor, '2026-10-01'
from (values ('Mercado', 600.00), ('Comer fora', 400.00), ('Lazer', 300.00),
             ('Compras', 300.00), ('Transporte', 250.00)) v(grupo, valor)
join grupos g on g.nome = v.grupo;

insert into debitos (competencia_inicio, descricao, valor, parcelas, categoria_id)
select '2026-10-01', v.descricao, v.valor, v.parcelas, c.id
from (values ('Feira', 180.00, 1, 'Mercado'), ('Restaurantes', 1400.00, 1, 'Comer fora'),
             ('Tênis', 120.00, 3, 'Roupa'), ('Farmácia', 60.00, 1, 'Saúde')) v(descricao, valor, parcelas, categoria)
join categorias c on c.nome = v.categoria;

-- Cartão Posto (fecha dia 23, vence 2 meses depois): abastecimento de setembro conta em outubro
insert into abastecimentos (data, valor, cartao_id)
select '2026-09-05', 150.00, id from cartoes where nome = 'Cartão Posto';

-- Esperado em v_orcamento_mes, outubro/2026:
--   renda 3450 · fixos 138,90 · reserva 200 (gasto 60) · parcelas 120 · comprometido 258,90
--   Comer fora passou 1000 → folga −38,90 → corte 38,90 · resta 961,10 · saldo_previsto 300
-- Em v_orcamento_grupos (resta depois do corte, proporcional ao que restava):
--   Mercado 403,66 · Comer fora 0 · Lazer 288,33 · Compras 173,00 · Transporte 96,11
-- Novembro (sem renda lançada, vale a base): folga 511,10 · corte 0 · saldo_previsto 811,10
