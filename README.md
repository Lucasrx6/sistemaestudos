# Sistema de Estudo para Concursos

Projeto Next.js App Router com Supabase, envio de questões por WhatsApp e correção de redações por IA.

## Setup local

1. Instale dependências:
   ```bash
   npm install
   ```
2. Copie `.env.example` para `.env.local` e preencha as variáveis.
3. Execute localmente:
   ```bash
   npm run dev
   ```

## Supabase

1. Crie um projeto no Supabase.
2. No painel SQL, execute `supabase/schema.sql`.
3. Configure Auth com email/senha.
4. Crie políticas RLS para proteger dados do usuário.

## Vercel

1. Crie um projeto Vercel apontando para este repositório.
2. Configure as variáveis de ambiente do `.env.example`.
3. Adicione `vercel.json` para o cron.
4. Para cron seguro, use `CRON_SECRET` no header `Authorization: Bearer ${CRON_SECRET}`.

## Evolution API

1. Defina `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME`.
2. Configure o webhook para `https://<seu-domínio>/api/whatsapp/webhook`.

## Primeiro admin

Defina `ADMIN_EMAIL` com o email do administrador. Usuários que fizerem login com esse email terão acesso às rotas de administração.
