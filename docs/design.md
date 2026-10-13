# Design

Tema escuro: fundo grafite quente com brilhos suaves, cartões em vidro e destaque âmbar. Tokens em `app/src/styles/tema.css`.

| Token | Valor | Uso |
|---|---|---|
| Fundo | #0E0D0C | grafite quente, com brilhos radiais âmbar e coral |
| Texto | #F5F2ED | branco-osso |
| Texto secundário | #C9C2B7 | cinza quente |
| Destaque | #F2B84B | mel: ações, seleção, valores comprometidos |
| Positivo | #8FCF9E | sálvia |
| Negativo | #F0533F | vermelho coral |
| Fonte | Onest | números em negrito pesado (700 a 800) |

Componentes: cartão de vidro (`.vidro`), pílula (`.pilula`), botão dourado (`.botao-mel`).

No topo da tela Mês, o **olho** esconde todos os valores (preferência salva no aparelho).

Abas (ilha flutuante), cada uma responde uma pergunta:

| Aba | Pergunta |
|---|---|
| **Mês** | Quanto sobra? Saldo (abre o resumo renda − cada cartão − fixas − débitos − gasolina), fatura por cartão, a receber, ritmo, categorias e parcelamentos |
| **Transações** | Pra onde foi? Tudo do mês agrupado como no resumo do saldo, com filtro **Pendentes**: compras novas a classificar (de quem é, categoria) |
| **Lançar** | Registrar renda, débito ou gasolina (pagamento recebido é o "Recebi" dos Acertos), com a lista do que já foi lançado no mês |
| **Acertos** | Quem me deve e quanto |
| **Mais** | Status dos bancos (quando o Meu Pluggy atualizou e quando o app leu), telefones das pessoas, contas fixas (criar, mudar valor, encerrar), sair |

A antiga aba Revisar virou o filtro Pendentes dentro de Transações (eram duas listas de compras quase iguais). As linhas do resumo do saldo abrem Transações já filtrada.

Satélites com "voltar": **Meses** (mês atual, próximos com valor já comprometido, anteriores fechados), Detalhes do mês e Categoria aberta.
