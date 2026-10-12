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
