# App (PWA)

Telas do Finance em React + TypeScript + Vite: Mês, Transações, Lançar, Acertos e Mais.
O design aprovado está documentado em `docs/design.md` e os tokens em `src/styles/tema.css`.

- `src/lib/dados.ts`: todas as consultas ao Supabase (só lê views; grava pelas tabelas ou funções do banco).
- `src/lib/cache.ts`: TanStack Query. Cada consulta roda uma vez; depois de gravar, `dadosMudaram()` atualiza.
- `src/pages/`: uma tela por arquivo. `src/components/`: peças reaproveitadas (seletor de mês, divisão, olho).

```bash
cp .env.example .env   # URL e chave pública (anon) do Supabase, e a chave Pix da cobrança
npm install
npm run dev
```
