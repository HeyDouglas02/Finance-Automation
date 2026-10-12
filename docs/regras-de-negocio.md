# Regras de negócio

Definidas antes da implementação e validadas contra três meses de dados reais (agosto a outubro de 2026).

## 1. Mês do orçamento (competência)

O orçamento de um mês é pago com a renda que cai no mês seguinte, como um salário: trabalha-se em outubro, recebe-se em novembro, e as contas de outubro são pagas com esse dinheiro.

- **Cartão de crédito:** a compra pertence ao mês em que a fatura **fecha** (mês anterior ao vencimento). Enquanto a fatura não fecha, o mês é estimado pelo dia de fechamento do cartão; depois, vale o que o banco informa.
- **Débito, gasolina, renda:** informados com o mês do orçamento.

## 2. Renda

- Registrada por mês e por fonte, com o valor esperado.
- Nada se repete sozinho: mês não preenchido fica zerado.

## 3. Contas fixas

- Valor fixo, com vigência (mês de início e, opcionalmente, de fim).
- Mudou o valor: encerra a conta antiga e cria uma nova.
- **Crédito:** aparece como *previsto* até a cobrança chegar na fatura; aí vale o valor cobrado. Se for diferente do esperado, fica marcada como divergente.
- **Débito:** aparece como *esperado*, com o valor cadastrado.
- A cobrança no cartão recebe a categoria *Conta fixa* para não ser contada duas vezes.

## 4. Compras no cartão

- Chegam automaticamente do banco, todo dia.
- Toda compra nova precisa de revisão (dono, divisão e categoria).
- Estorno entra negativo. Juros, IOF e encargos entram na categoria *Taxas*.
- Pagamento da fatura é ignorado (senão a compra contaria duas vezes).
- Compras internacionais usam o valor cobrado em reais, não o valor na moeda original.

## 5. Parcelas

- As parcelas futuras são previstas a partir da última conhecida.
- Quando a parcela real chega, substitui a previsão. Se o valor mudar, fica marcada.
- A classificação dada a uma parcela vale para as seguintes da mesma compra.
- Parcelas da mesma compra são agrupadas mesmo que o banco informe a data da compra com até 5 dias de diferença.

## 6. Débito

- Avulso ou parcelado (um registro gera um lançamento por mês).
- Tem dono e divisão, como qualquer outro lançamento.

## 7. Gasolina (cartões não conectados)

- Cada abastecimento é anotado com data, valor e cartão.
- O vencimento é calculado pela regra de cada cartão (fechamento, vencimento e meses até vencer).
- Conta no mês anterior ao vencimento.

## 8. Pessoas e divisões

- Um gasto pode ser inteiro de outra pessoa ou dividido (valor fixo ou porcentagem).
- O que não é de ninguém é do dono do app.
- No orçamento entra só a parte do dono; o resto vai para os acertos.

## 9. Acertos

- Vistos mês a mês: quanto cada pessoa deve, com a lista de itens.
- Pagamentos são registrados por mês e pessoa; o mês fica *pago* quando o valor recebido cobre o devido.

## 10. Conferência de faturas

- Para cada fatura: total do banco, soma das compras recebidas, encargos e diferença.
- Diferenças são mostradas, não corrigidas automaticamente.
- A fatura é marcada como paga quando o pagamento aparece no cartão.
