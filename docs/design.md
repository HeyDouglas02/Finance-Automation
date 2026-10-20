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

No topo de cada aba, o **olho** esconde todos os valores (preferência salva no aparelho). **Puxar a tela pra baixo** recarrega os dados; ao voltar pro app depois de 1h, recarrega sozinho.

Abas (ilha flutuante), cada uma responde uma pergunta:

| Aba | Pergunta |
|---|---|
| **Mês** | Quanto ainda posso gastar? Mês aberto: **Pode gastar** (soma do que resta nos limites, já guardando a meta); mês que passou: **Saldo do mês**. Tocar abre o resumo (renda − cada cartão − fixas − débitos − gasolina). Fatura por cartão, a receber, ritmo, categorias (quanto resta em cada grupo e na reserva) e parcelamentos com o teto |
| **Transações** | Pra onde foi? Tudo do mês agrupado como no resumo do saldo, com filtro **Pendentes**: compras novas a classificar (de quem é, categoria) |
| **Lançar** | Registrar renda, débito ou gasolina (pagamento recebido é o "Recebi" dos Acertos), com a lista do que já foi lançado no mês. Tocar num lançamento (aqui ou em Transações) abre **Corrigir**: mesmo formulário, preenchido, com Salvar e Excluir |
| **Acertos** | Quem me deve e quanto |
| **Mais** | Status dos bancos (quando o Meu Pluggy atualizou e quando o app leu), telefones das pessoas, contas fixas (criar, mudar valor, encerrar), limites do mês em reais por grupo mais renda base, reserva, meta e teto (com a conta "o orçamento fecha"), sair |

A antiga aba Revisar virou o filtro Pendentes dentro de Transações (eram duas listas de compras quase iguais). As linhas do resumo do saldo abrem Transações já filtrada.

Satélites com "voltar": **Meses** (mês atual, próximos com valor já comprometido, anteriores fechados), Detalhes do mês e Categoria aberta.
