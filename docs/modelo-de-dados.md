# Modelo de dados

PostgreSQL (Supabase). Todo "mês do orçamento" é guardado como o 1º dia do mês (`date`).

## Diagrama

```mermaid
erDiagram
  cartoes ||--o{ transacoes : ""
  cartoes ||--o{ faturas : ""
  cartoes ||--o{ abastecimentos : ""
  categorias ||--o{ transacoes : ""
  categorias ||--o{ debitos : ""
  categorias ||--o{ regras_categoria : ""
  grupos ||--o{ categorias : ""
  grupos ||--o{ limites : ""
  pessoas ||--o{ rateios : ""
  pessoas ||--o{ pagamentos : ""
  transacoes ||--o{ rateios : ""
  debitos ||--o{ rateios : ""
  abastecimentos ||--o{ rateios : ""
```

## Tabelas

**Cadastros**

| Tabela | Para quê |
|---|---|
| `pessoas` | Quem divide gastos (o dono do app é implícito), com telefone pra cobrança no WhatsApp |
| `grupos` | O que aparece no orçamento: com limite, reserva, fixo ou sem limite (regra 12) |
| `categorias` | Detalhe de um grupo (ex.: Gasolina e Uber/ônibus em Transporte) |
| `cartoes` | Cartões conectados ou não, com regras de fechamento e vencimento |
| `regras_categoria` | Texto da descrição → categoria (e divisão padrão opcional); com valor, só vale para compras desse valor |
| `contas_fixas` | Contas recorrentes com vigência |
| `limites` | Limite em reais de cada grupo, com vigência (regra 14) |
| `orcamento` | Renda base, reserva, meta e teto de parcelas, com vigência (regras 13 a 17) |

**Movimento**

| Tabela | Origem |
|---|---|
| `transacoes` | Pluggy (cartões) |
| `faturas` | Pluggy |
| `conexoes` | Pluggy (status de cada banco) |
| `renda` | Manual |
| `debitos` | Manual (avulso ou parcelado) |
| `abastecimentos` | Manual (cartões não conectados) |
| `pagamentos` | Manual (acertos recebidos) |
| `rateios` | Parte de cada pessoa em uma transação, débito ou abastecimento |

## Decisões de modelagem

- **Rateios em tabela própria.** Em vez de um texto como `"Mãe 100; Eu 30,26"`, cada parte é uma linha (valor fixo **ou** percentual). O que não está em rateio é do dono. Isso torna os acertos uma simples soma.
- **Previsões não são gravadas.** Parcelas futuras e contas fixas previstas são geradas pelas views a cada consulta, então nunca ficam desatualizadas.
- **IDs da Pluggy como chave** em `transacoes` e `faturas`, o que torna a sincronização idempotente (upsert).
- **Competência gravada na transação**, recalculada a cada sincronização a partir da fatura (ou do dia de fechamento, se a fatura ainda não fechou).

## Funções

| Função | Faz |
|---|---|
| `classificar(transacao, categoria, rateios)` | Grava categoria + divisão de uma compra e das parcelas seguintes, numa transação só (regra 11) |
| `lancar_debito(competencia, descricao, valor, parcelas, categoria, rateios)` | Cria um débito com a divisão, numa transação só (regra 6) |
| `editar_debito(debito, competencia, descricao, valor, parcelas, categoria, rateios)` | Corrige um débito com a divisão, numa transação só (vale pra todas as parcelas) |
| `mudar_valor_conta_fixa(conta, valor, a_partir)` | Encerra a conta fixa antiga e cria a nova com o valor novo (regra 3) |
| `definir_limite(grupo, valor, a_partir)` | Limite de um grupo a partir do mês, com vigência; valor vazio encerra (regra 14) |
| `definir_orcamento(a_partir, renda_base, reserva, meta, teto)` | Renda base, reserva, meta e teto de parcelas a partir do mês, com vigência (regras 13, 15 a 17) |

## Views

| View | Conteúdo |
|---|---|
| `v_itens` | Base: transações reais, parcelas futuras, contas fixas, débitos, gasolina e renda |
| `v_partes` | A parte de cada pessoa em cada item (rateios) |
| `v_lancamentos` | Tudo junto, com mês, tipo, valor, parte do dono e status (real, previsto, esperado, manual) |
| `v_mes` | Renda, saídas por grupo e sobra de cada mês |
| `v_acertos` | Devido e pago por pessoa e mês |
| `v_categorias_mes` | Sua parte gasta em cada categoria, por mês, com o grupo |
| `v_orcamento_base` | Cada mês com orçamento × cada grupo: limite e gasto (base das duas seguintes) |
| `v_orcamento_mes` | O mês inteiro: fixos, reserva, parcelas × teto, comprometido, folga, corte e saldo previsto |
| `v_orcamento_grupos` | Cada grupo no mês: limite, gasto, excesso e quanto ainda resta depois do corte proporcional |
| `v_parcelamentos` | Cada parcela do mês (real ou prevista), com a sua parte, quanto falta e o mês da última |
| `v_ritmo` | Sua parte acumulada dia a dia |
| `v_faturas_mes` | Fatura de cada cartão por mês: total do banco se fechada; se aberta ou futura, compras que já chegaram + parcelas previstas. Com soma das compras e encargos pra conferência (regra 10) |
