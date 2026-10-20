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
- A cobrança no cartão recebe a categoria *Fixos* para não ser contada duas vezes.
- A cobrança é reconhecida pela regra automática (texto da fatura). Quando o mesmo texto aparece em outras compras (ex.: apple.com), a regra exige também o valor; cobrança com o texto mas com outro valor fica pendente.

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
- Entra na categoria *Transporte*, detalhe *Gasolina*.

## 8. Pessoas e divisões

- Um gasto pode ser inteiro de outra pessoa ou dividido (valor fixo ou porcentagem).
- O que não é de ninguém é do dono do app.
- No orçamento entra só a parte do dono; o resto vai para os acertos.

## 9. Acertos

- Vistos mês a mês: quanto cada pessoa deve, com a lista de itens.
- O acerto de um mês é da mesma competência dos gastos: as compras de outubro (fatura que vence em novembro) entram no acerto de outubro.
- O pagamento é sempre do valor exato do mês: não há saldo passando de um mês para o outro. **Recebi** registra o pagamento da pessoa naquele mês.
- **Cobrança:** abre o WhatsApp da pessoa (link `wa.me`) com a mensagem pronta (itens, total e chave Pix); o envio é manual.
- Pagamentos são registrados por mês e pessoa; o mês fica *pago* quando o valor recebido cobre o devido.

## 10. Conferência de faturas

- Para cada fatura: total do banco, soma das compras recebidas, encargos e diferença.
- Diferenças são mostradas, não corrigidas automaticamente.
- A fatura é marcada como paga quando o pagamento aparece no cartão.

## 11. Classificação

- Compra nova do banco que não herdou classificação fica **pendente** (sem categoria ou com a sugerida por regra). Pendente é um status, não uma categoria.
- Classificar = escolher **de quem é** (minha, inteira de uma pessoa, ou dividida por valor fixo ou %) e **a categoria**. Confirmar marca como revisada.
- A soma das partes dos outros não pode passar do valor da compra; o resto é do dono.
- **Parcelas:** a classificação vale para a parcela escolhida **e as seguintes** da mesma compra, mesmo as já revisadas. As anteriores não mudam. As previstas acompanham sozinhas (herdam da última real).
- Qualquer compra pode ser reclassificada depois, com a mesma regra.

## 12. Categorias

- Cada compra cai em **uma** categoria, sem dúvida. Se uma compra serve em duas, a categoria está mal definida.
- Algumas categorias têm **detalhe** (ex.: Transporte → Gasolina, Uber/ônibus). O limite vale para a categoria; o detalhe serve para ver onde foi o gasto.

| Categoria | Detalhe | O que entra | Limite |
|---|---|---|---|
| Mercado | | supermercado, açougue, suplemento | sim |
| Comer fora | | iFood, restaurante, lanche, padaria, café | sim |
| Lazer | | passeios, viagens, ingressos, jogos, futebol | sim |
| Compras | Roupa · Eletrônicos · Presentes · Outros | lojas, Shopee, Mercado Livre | sim |
| Transporte | Gasolina · Uber/ônibus | | sim |
| Fixos | | contas fixas | não |
| Saúde | | farmácia, óculos, consulta | reserva |
| Imprevistos | | carro (mecânica, peças, bateria) | reserva |
| Taxas | | juros, IOF, encargos | não |

## 13. Orçamento do mês

O mês é dividido assim, a partir de uma **renda base** (hoje R$ 1.385):

```
Renda base
− Fixos (contas fixas)
− Reserva (Saúde + Imprevistos)
− Meta
= Soma dos limites
```

- A renda base serve só para montar os valores. No mês a mês vale a renda real: entrou mais, sobra mais, e os limites não mudam.
- Mês sem renda lançada (começo do mês, meses futuros): vale a renda base.
- Se fixos + reserva + meta + limites passarem da renda base, o app avisa (o orçamento não fecha).
- **Comprometido** = fixos + parcelas do mês. Aparece no começo do mês junto com a projeção dos meses seguintes, para mostrar quanto da renda já está decidido.

## 14. Limites

- Valor **em reais** por categoria. Vale até ser mudado (como as contas fixas, com vigência).
- Conta só a **minha parte** (regra 8).
- A **parcela** conta na categoria dela, no mês em que cai. Ela não é um gasto a mais: já está nas saídas do mês.
- Situação: dentro do limite; **perto** a partir de 80%; **passou** acima de 100%.
- Cada mês fecha sozinho: sobra ou estouro não passa para o mês seguinte.
- **O que passa é tirado das outras.** O excesso de uma categoria (ou da reserva) é descontado do que ainda resta nas categorias com limite, na proporção do que resta em cada uma. Assim, respeitando o "resta" de todas, o mês fecha na meta.
- Também entra nesse desconto a renda real abaixo da renda base. Renda acima da base vai para o saldo.
- Se o excesso for maior que tudo o que resta, todas ficam zeradas e o app avisa quanto o mês está abaixo da meta.
- A reserva não usada não volta para as categorias durante o mês (um imprevisto ainda pode acontecer); só vira saldo no fim.

## 15. Reserva para Saúde e Imprevistos

- Um valor único por mês para as duas categorias, porque nenhuma das duas é escolha.
- Não acumula: o que não for usado vira saldo do mês; o que passar diminui o saldo.
- Parcelas dessas categorias ocupam a reserva do mês em que caem.

## 16. Meta

- É o alvo para o **saldo do mês** (renda − saídas). Vale até ser mudada.
- O saldo é comparado com a meta: acima, abaixo ou igual.

## 17. Teto de parcelas

- Valor máximo para a soma de **todas** as minhas parcelas no mês, de qualquer categoria: do cartão e débitos lançados em mais de uma parcela.
- Só avisa, não bloqueia.
- O limite da categoria olha o mês atual; o teto olha os meses seguintes. A mesma parcela aparece nos dois, mas sai do saldo uma vez só.
- Mostra quanto ainda cabe de parcela nova em cada um dos próximos meses.
