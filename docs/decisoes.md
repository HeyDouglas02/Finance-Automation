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
