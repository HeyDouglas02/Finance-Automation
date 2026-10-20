# Proposta: categorias, limites, reserva, meta e teto

Substitui a regra 12 (limites em % da renda). Desenhada em 20/10/2026 a partir dos dados reais de agosto a outubro de 2026. Antes de qualquer código, esta proposta vira texto em `regras-de-negocio.md` e uma entrada em `decisoes.md`.

## Por que mudar

- As 20 categorias vieram de uma planilha antiga: muitas se sobrepõem (Saúde × Necessidades, Contas × Conta fixa) e algumas misturam *o que* foi comprado com *como* o gasto entrou (Conta fixa, Gasolina, A revisar).
- Limite em % da renda não é intuitivo e muda de valor todo mês.
- Os limites tinham sido copiados do gasto real, então só diziam "gastou igual ao mês passado".
- Fixos e parcelas não eram considerados: de 27% a 47% da renda já está comprometida no dia 1.

## 1. Categorias

**Com limite** (gasto que eu escolho fazer):

| Categoria | Detalhe | O que entra |
|---|---|---|
| Mercado | | supermercado, açougue, suplemento |
| Comer fora | | iFood, restaurante, lanche, padaria, café |
| Lazer | | passeios, viagens, ingressos, jogos, futebol |
| Compras | Roupa · Eletrônicos · Presentes · Outros | lojas, Shopee, Mercado Livre |
| Transporte | Gasolina · Uber/ônibus | |

**Sem limite:**

| Categoria | O que entra |
|---|---|
| Fixos | contas fixas cadastradas |
| Saúde | farmácia, óculos, consulta |
| Imprevistos | mecânica, autopeças, bateria |
| Taxas | juros, IOF (automático) |

**De-para das categorias antigas:**

| Antiga | Nova |
|---|---|
| IFood/restaurante | Comer fora |
| Mercado | Mercado |
| Lazer | Lazer |
| Roupa, Eletrônicos, Presentes, Beleza, Desenvolvimento | Compras |
| Gasolina, Uber/transporte | Transporte |
| Conta fixa, Contas | Fixos |
| Saúde, Necessidades | Saúde |
| Despesas eventuais | Imprevistos (carro) ou Compras (o resto) |
| Taxas | Taxas |
| Aluguel, Faculdade | saem (não uso) |
| A revisar | deixa de ser categoria e vira status de pendente |

Agrupar, não fundir: o detalhe (Gasolina × Uber, Roupa × Eletrônicos) continua visível dentro do grupo.

Teste de uma categoria bem definida: toda compra cai em uma só, sem dúvida.

## 2. O orçamento do mês

```
Renda base                    1.385,00
− Fixos                         379,90
− Reserva Saúde + Imprevistos   100,00
− Meta                           50,00
= Limites                       855,00
```

A renda base serve só para montar os valores. No mês a mês vale a renda real: entrou mais, sobra mais, e os limites não mudam.

## 3. Limites

| Categoria | Limite |
|---|---|
| Mercado | 250 |
| Comer fora | 200 |
| Lazer | 185 |
| Compras | 120 |
| Transporte | 100 |
| **Total** | **855** |

- Em reais, e valem até serem mudados.
- Contam só a minha parte (regra 8).
- A parcela conta na categoria dela, no mês em que cai. Ela não é um gasto a mais: já está no total de saídas.
- Cada mês fecha sozinho, sem levar sobra nem estouro para o mês seguinte.

## 4. Reserva para Saúde e Imprevistos (R$ 100)

- Um valor único para as duas categorias, porque nenhuma das duas é escolha.
- Não acumula: o que não for usado vira saldo do mês, e o que passar diminui o saldo.
- Parcelas dessas categorias ocupam a reserva do mês em que caem.

## 5. Meta (R$ 50)

Alvo para o **Saldo do mês** que já existe. Pode ser mudada.

## 6. Teto de parcelas (R$ 150)

- Máximo para a soma de todas as minhas parcelas no mês, de todas as categorias.
- Só avisa, não bloqueia.
- O limite da categoria olha **este mês**; o teto olha **os próximos meses**. A mesma parcela aparece nos dois, mas sai do saldo uma vez só.
- Usado principalmente antes de parcelar: "se eu parcelar isso, como ficam os próximos meses?"

## 7. Comprometido

Fixos + parcelas, mostrado no começo do mês, com o livre e a projeção dos meses seguintes:

| Mês | Fixos | Parcelas | Comprometido |
|---|---|---|---|
| nov/26 | 379,90 | 283,76 | 663,66 |
| dez/26 | 379,90 | 253,50 | 633,40 |
| jan/27 | 379,90 | 167,11 | 547,01 |
| fev/27 | 379,90 | 42,99 | 422,89 |
| mar/27 | 379,90 | 0,00 | 379,90 |

## 8. Transição

De novembro a janeiro, o teto e a reserva passam por causa de parcelas já assumidas: óculos (98,33 até janeiro) e bateria (71,25 até dezembro). Em novembro, Transporte também passa (gasolina de 170). É esperado, não é erro. Os valores valem por completo a partir de fevereiro.

## 9. Correções nos dados

- Cadastrar o Spotify (R$ 6, mensal) como conta fixa.
- Apple: a conta fixa reconhece a cobrança pelo texto **e** pelo valor (R$ 19,90). Outras cobranças da apple.com ficam pendentes.
- JIM.COM é maquininha: as cobranças de R$ 65 são a barbearia. O reconhecimento não pode puxar outras lojas que usam a mesma maquininha.
- Regras: ERD PRESENTES → Saúde (é ótica); LIV CTBA → Lazer; TOTALCOMERCIO → Imprevistos.
- Reclassificar o histórico pelo de-para acima.

## 10. Ordem

1. Regra escrita e aprovada (`regras-de-negocio.md` + `decisoes.md`).
2. Banco: categorias, grupos, limites, reserva, meta e teto; reclassificação do histórico.
3. Desenho da tela.
4. Código do app.
