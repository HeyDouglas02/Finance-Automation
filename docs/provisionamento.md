# Provisionamento: um app para uma pessoa nova

Roteiro para montar o Finance de outra pessoa, com banco próprio (um banco por pessoa). O código é o mesmo; muda só a configuração. Escrito montando o app da Duda; depois vira script (passo 3 do roadmap).

**Quem faz:** **[pessoa]** = a dona do app (as contas são dela) · **[monta]** = quem monta, no computador, com o repositório.

Nenhuma chave entra no Git. Tudo que é segredo vai para o Supabase (Secrets/Vault) ou para a Vercel.

---

## 1. Contas da pessoa [pessoa]

| Conta | Para quê | Onde |
|---|---|---|
| Supabase | O banco dela. Plano grátis | supabase.com |
| Meu Pluggy | Ligar os bancos dela ao app | meu.pluggy.ai |

No Meu Pluggy:
1. Conectar cada banco (login do banco feito por ela).
2. Anotar o **código de cada conexão** (item id). Vai na tela Bancos do app (regra 21), no passo 7.
3. Pegar o **Client ID** e o **Client Secret**. São as chaves que a sincronização usa (passo 4).

## 2. Projeto no Supabase [pessoa + monta]

1. **[pessoa]** Criar o projeto: região **São Paulo**, guardar a senha do banco.
2. **[pessoa]** Gerar um **token de acesso** (Account → Access Tokens) e passar para quem monta. É o que deixa a CLI mexer no projeto dela sem ela precisar estar junto. **Apagar o token no fim (passo 8).**
3. **[monta]** No repositório, apontar a CLI para o projeto dela:
   ```bash
   export SUPABASE_ACCESS_TOKEN=<token dela>
   npx supabase link --project-ref <ref do projeto dela>
   ```
   > O `link` pede a **senha do banco** do item 1: ela passa junto com o token.
   > O `link` troca o projeto ligado à pasta. Ao terminar, religar o próprio: `npx supabase link --project-ref <seu ref>` (com o seu token).

## 3. Banco [monta]

```bash
npx supabase db push
```
Cria tabelas, views, funções, RLS e o agendamento. As migrations só cadastram dados genéricos (categorias e grupos do orçamento); nada pessoal.

## 4. Sincronização [monta]

1. Segredos da função (as chaves do Meu Pluggy dela, passo 1, e um segredo novo só dela):
   ```bash
   npx supabase secrets set PLUGGY_CLIENT_ID=... PLUGGY_CLIENT_SECRET=... CRON_SECRET=<texto aleatório longo>
   ```
2. Publicar a função:
   ```bash
   npx supabase functions deploy sync-pluggy --use-api --no-verify-jwt
   ```
3. Cofre (Vault), no SQL Editor do projeto dela. É o que o agendamento usa para chamar a função:
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<o mesmo CRON_SECRET>', 'cron_secret');
   ```

## 5. Login [pessoa + monta]

1. **[monta]** Authentication → Sign In / Providers: **desligar cadastro** (ninguém se cadastra sozinho).
2. **[monta]** Authentication → Users → **Add user**: e-mail dela e uma senha provisória.
3. **[monta]** SQL Editor: marcar como dona (sem isso o RLS não mostra nada):
   ```sql
   insert into private.donos (user_id)
   select id from auth.users where email = '<e-mail dela>';
   ```

## 6. Site na Vercel [monta]

1. Novo projeto a partir do mesmo repositório, **Root Directory = `app`**.
2. Variáveis de ambiente (Project Settings → API Keys do Supabase dela):
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = chave **publicável** (nunca a secreta)
3. Deploy. Cada push em `main` atualiza os dois sites.

## 7. Primeiro uso [pessoa]

No app, aba **Mais**:
1. **Bancos** → colar o código de cada conexão (passo 1). Os cartões aparecem sozinhos na próxima sincronização (até 3h).
2. **Cartões** → conferir os dias (se aparecer "Confira os dias").
3. **Pessoas**, **Contas fixas**, **Limites do mês** e **Chave Pix**.
4. Instalar no celular (Compartilhar → Adicionar à Tela de Início).

## 8. Conferir e fechar [monta + pessoa]

- Security Advisor do projeto dela: só o aviso de "leaked password" é esperado.
- Depois da primeira sincronização: Mais → Bancos "Conectado", cartões criados.
- **[pessoa]** **Apagar o token de acesso** do passo 2.
- **[monta]** Religar a CLI ao seu projeto.
