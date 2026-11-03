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
| Pluggy Dashboard | As chaves (Client ID/Secret) que o app usa para ler o Meu Pluggy | dashboard.pluggy.ai (mesmo e-mail) |

São duas telas diferentes da Pluggy (guia oficial "Personal use: read your own data with Meu Pluggy"):
1. **meu.pluggy.ai:** criar a conta e conectar cada banco (login do banco feito por ela).
2. **dashboard.pluggy.ai**, com o mesmo e-mail: Aplicações → a aplicação dela → **Demo → Conectar conta** → escolher o conector **MeuPluggy** (não o banco, nem o Sandbox) e entrar com a conta do Meu Pluggy.
3. Anotar, num lugar seguro:
   - **Client ID:** na linha da aplicação, em Aplicações.
   - **Client Secret:** aparece **uma vez só**, quando é gerado. Perdeu, gera outro na página da aplicação.
   - **Código de cada conexão** (item id): Demo → Connected Items → clicar no item e copiar. Vai na tela Bancos do app (regra 21), no passo 7.

O aviso de "trial" do Dashboard não afeta: o uso pessoal pelo Meu Pluggy não expira com o trial. Limites: só uso pessoal, até 5 conexões. A autorização de cada banco vale **1 ano**; depois, repetir o item 2.

## 2. Projeto no Supabase [pessoa + monta]

Tudo pela CLI, numa **pasta separada** do repositório: o `supabase link` grava na pasta qual projeto ela usa, e na mesma pasta um `db push` esquecido iria para o banco errado. O clone traz só o que está no Git (`supabase/local`, com dados pessoais, fica de fora).

1. **[pessoa]** Gerar um **token de acesso**: Account preferences → Access Tokens → Generate new token. Expira em **7 dias**, Resource access **Organization** (escolher a organização dela), Permissions **Full access**. Passar para quem monta; **apagar no fim (passo 8)**.
2. **[monta]** Pasta própria e CLI com a conta dela (PowerShell; o token vale só nessa janela):
   ```powershell
   git clone C:\Projects\Finance-Automation C:\Projects\Finance-<pessoa>
   cd C:\Projects\Finance-<pessoa>
   npm install
   $env:SUPABASE_ACCESS_TOKEN = "<token dela>"
   npx supabase orgs list        # ID da organização
   npx supabase projects list    # já tem projeto?
   ```
   > Ao criar a conta, o Supabase pode criar sozinho um projeto em **West US (Oregon)**. Região não muda depois: criar outro em São Paulo e apagar esse (`npx supabase projects delete <ref>`), se estiver vazio.
3. **[monta]** Senha do banco e projeto (a senha vai direto para a área de transferência, sem aparecer na tela; guardar no gerenciador de senhas):
   ```powershell
   $senha = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
   $senha | Set-Clipboard
   npx supabase projects create finance --org-id <org> --region sa-east-1 --db-password $senha
   npx supabase link --project-ref <ref do projeto novo> --password $senha
   ```
   > Nunca colar saída de terminal com senha ou token em chat ou print.

## 3. Banco [monta]

```bash
npx supabase db push
```
Cria tabelas, views, funções, RLS e o agendamento. As migrations só cadastram dados genéricos (categorias e grupos do orçamento); nada pessoal.

## 4. Sincronização [monta]

Segredos entram por variável (`Read-Host`), sem aparecer na tela nem ficar no histórico do terminal.

1. Segredos da função: as chaves do Pluggy (passo 1) e a `CRON_SECRET`, a "senha da porta" que só o agendamento tem:
   ```powershell
   $clientId = Read-Host "Client ID"
   $clientSecret = Read-Host "Client Secret"
   $cron = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 40 | ForEach-Object { [char]$_ })
   npx supabase secrets set "PLUGGY_CLIENT_ID=$clientId" "PLUGGY_CLIENT_SECRET=$clientSecret" "CRON_SECRET=$cron"
   ```
2. Publicar a função:
   ```powershell
   npx supabase functions deploy sync-pluggy --use-api --no-verify-jwt
   ```
3. Cofre (Vault): o endereço e a senha da porta que o agendamento usa (a saída mostra só os ids dos segredos):
   ```powershell
   $sql = "select vault.create_secret('https://<ref>.supabase.co', 'project_url'); select vault.create_secret('$cron', 'cron_secret');"
   [IO.File]::WriteAllText("$env:TEMP\vault.sql", $sql)
   npx supabase db query --linked -f "$env:TEMP\vault.sql"
   Remove-Item "$env:TEMP\vault.sql"
   ```
4. Testar: resposta com zeros = senha da porta e chaves do Pluggy certas (ainda não há banco cadastrado).
   ```powershell
   Invoke-RestMethod -Method Post -Uri "https://<ref>.supabase.co/functions/v1/sync-pluggy" -Headers @{ "x-cron-secret" = $cron }
   ```

## 5. Login [pessoa + monta]

1. Desligar o cadastro público (API de gerenciamento, com o token do passo 2); conferir `disable_signup : True` na resposta:
   ```powershell
   Invoke-RestMethod -Method Patch -Uri "https://api.supabase.com/v1/projects/<ref>/config/auth" -Headers @{ Authorization = "Bearer $env:SUPABASE_ACCESS_TOKEN" } -ContentType "application/json" -Body '{"disable_signup": true}'
   ```
2. Criar o usuário. Precisa da chave mestra (`service_role`, a legacy; a `secret` nova nem sempre é aceita como Bearer), que fica só na variável. **A pessoa digita a própria senha** (mínimo 6):
   ```powershell
   $chaves = npx supabase projects api-keys --project-ref <ref> -o json | ConvertFrom-Json
   $servico = ($chaves | Where-Object { $_.name -eq 'service_role' }).api_key
   $email = Read-Host "E-mail"
   $s = Read-Host "Senha (a pessoa digita)" -AsSecureString
   $senhaPessoa = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
   $corpo = @{ email = $email; password = $senhaPessoa; email_confirm = $true } | ConvertTo-Json
   Invoke-RestMethod -Method Post -Uri "https://<ref>.supabase.co/auth/v1/admin/users" -Headers @{ apikey = $servico; Authorization = "Bearer $servico" } -ContentType "application/json" -Body $corpo
   ```
   `email_confirm` evita o e-mail de confirmação (que apontaria para `localhost`). Anotar o **id** da resposta.
3. Marcar como dona (sem isso o RLS não mostra nada); o `count` tem que dar 1:
   ```powershell
   [IO.File]::WriteAllText("$env:TEMP\dona.sql", "insert into private.donos (user_id) values ('<id>'); select count(*) as donos from private.donos;")
   npx supabase db query --linked -f "$env:TEMP\dona.sql"
   Remove-Item "$env:TEMP\dona.sql"
   Remove-Variable servico, chaves, senhaPessoa, s
   ```

## 6. Site na Vercel [monta]

1. Novo projeto a partir do mesmo repositório, **Root Directory = `app`**.
2. Variáveis de ambiente (Project Settings → API Keys do Supabase dela):
   - `VITE_SUPABASE_URL` = `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = chave **publicável** (nunca a secreta)
   > Para ver só a publicável, guardar a lista numa variável antes de filtrar. No PowerShell 5, filtrar direto no pipe do `ConvertFrom-Json` não funciona e **mostra todas as chaves, inclusive a service_role**:
   > ```powershell
   > $chaves = npx supabase projects api-keys --project-ref <ref> -o json | ConvertFrom-Json
   > ($chaves | Where-Object { $_.type -eq 'publishable' }).api_key
   > ```
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
- **[monta]** Fechar a janela do PowerShell (o token some com ela). A pasta `Finance-<pessoa>` fica para as próximas atualizações do app dela.
