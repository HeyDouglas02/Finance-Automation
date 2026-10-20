# Decisões

Registro das principais decisões técnicas e do motivo de cada uma.

## 001 · Definir regras de negócio antes de construir

A primeira versão foi construída antes das regras estarem claras, e cada ajuste gerava retrabalho. A partir daí, cada parte do sistema passou a ter a regra escrita (`regras-de-negocio.md`) antes da implementação.

## 002 · Open Finance via Pluggy (Meu Pluggy)

Gratuito para uso pessoal, cobre cartões de crédito com parcelas e faturas, e o acesso é só leitura. O consentimento é dado no app do próprio banco.

## 003 · MVP só com cartão de crédito

Conta corrente e Pix trazem muito ruído (investimentos, transferências entre contas próprias, pagamentos com várias finalidades). O MVP começou só com crédito, o que permitiu validar as faturas mês a mês. Débitos entram como lançamento manual.

## 004 · Validação contra dados reais

Agosto, setembro e outubro de 2026 foram conferidos contra a planilha manual. Todas as diferenças foram explicadas: uma transação que a API não entregou, um estorno com sinal invertido pelo banco, e IOF/juros que a planilha manual não registrava.

## 005 · Apps Script como protótipo, Supabase como produto

O protótipo em Google Sheets + Apps Script validou as regras sem custo, mas cada ação levava de 2 a 5 segundos. A versão final usa Supabase (PostgreSQL, Auth, Edge Functions) no plano gratuito.

## 006 · Lógica no banco

Previsões, lançamentos e acertos são views em SQL, em vez de dados gravados. O banco calcula na hora, e nada fica desatualizado.

## 007 · Sem pagamentos automáticos

O app avisa o que vence e quanto já está comprometido, mas não inicia pagamentos. Iniciar Pix por API exige contrato com intermediário e aumenta o risco sem resolver um problema real.

## 008 · Cobrança pelo WhatsApp via link, não API

Um link `wa.me` com a mensagem e o Pix copia e cola já preenchidos resolve o caso de uso sem custo. A API oficial exige conta comercial e cobra por mensagem; APIs não oficiais violam os termos do WhatsApp.

## 009 · Revisar dentro de Transações

O design previa uma aba Revisar e uma tela Transações, mas a Revisar já era uma lista de compras com filtro. Eram duas listas quase iguais. Ficou uma aba só, Transações, com o filtro Pendentes para classificar.

## 010 · Gravações de várias linhas em funções do banco

Classificar (categoria + rateios + parcelas seguintes), lançar débito com divisão e mudar o valor de uma conta fixa mexem em mais de uma linha. Cada uma virou uma função SQL (`security invoker`, respeita o RLS) que grava tudo numa transação: o app nunca deixa um registro pela metade.

## 011 · Acerto sem saldo acumulado

Os pagamentos são sempre do valor exato do mês, então cada mês fecha sozinho. Não há crédito ou débito passando de um mês para o outro (a planilha antiga tinha, e quase nunca era usado).

## 012 · Cache no app em vez de buscar a cada tela

Os dados só mudam com a sincronização diária ou quando o próprio app grava algo. Com TanStack Query, cada tela busca uma vez e depois mostra na hora; qualquer gravação marca tudo para atualizar.

## 013 · Categorias novas e limites em reais

A primeira versão dos limites (em % da renda, sobre as 20 categorias da planilha antiga) ficou confusa: categorias sobrepostas, percentuais com decimais estranhos, limites copiados do gasto real e nenhuma conta para fixos e parcelas, que comprometem de 27% a 47% da renda antes do mês começar. Tudo foi redesenhado a partir dos gastos reais de agosto a outubro de 2026 (regras 12 a 17, detalhes em `proposta-orcamento.md`):

- 9 categorias no lugar de 20, só 5 com limite (as que são escolha).
- Limite em reais, montado sobre uma renda base; a renda real só muda o saldo.
- Saúde e Imprevistos dividem uma reserva mensal, que não acumula.
- Meta como alvo do saldo do mês que já existia.
- Teto para a soma das parcelas, porque parcelar não pode ser um jeito de escapar do limite.
