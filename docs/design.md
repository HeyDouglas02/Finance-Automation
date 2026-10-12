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

Telas: **Mês** (saldo do mês, fatura, a receber, ritmo e categorias), **Revisar** (uma compra por vez), **Lançar**, **Acertos** e **Mais**. Navegação por uma ilha de abas flutuante. Satélites com "voltar": **Meses** (mês atual, próximos com valor já comprometido, anteriores fechados), Detalhes do mês, Transações e Categoria aberta.
