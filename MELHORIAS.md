# Prompt de Melhorias — Sistema de Estudo para Concursos Públicos

## Contexto do Sistema

Aplicação Next.js 14 (App Router) + TypeScript + Supabase (PostgreSQL + RLS) + Bootstrap 5 via CDN. Sem Tailwind, sem Prisma, sem shadcn. Estilização exclusivamente via classes Bootstrap.

**Stack:**
- Framework: Next.js 14 App Router (`app/` directory)
- Banco: Supabase (PostgreSQL com RLS habilitado)
- Auth: Supabase Auth (JWT via `getUser(token)` no servidor com `supabaseAdmin`)
- Validação: Zod (schemas em `lib/schemas/questao.ts`)
- UI: Bootstrap 5 via CDN (sem instalação npm), Font Awesome para ícones
- ORM: Supabase JS SDK direto (sem Prisma)

**Estrutura de rotas relevantes:**
```
app/
  (public)/
    cadastro/page.tsx        ← cadastro de novo usuário
  (auth)/
    estudar/page.tsx         ← sessão de estudo direta no site
    configuracoes/page.tsx   ← configurações do perfil do usuário
  (admin)/
    admin/importar/page.tsx  ← upload de questões em JSON (admin)

app/api/
  questoes/proximas/route.ts      ← GET, retorna questões para estudar
  questoes/responder/route.ts     ← POST, registra resposta
  usuarios/perfil/route.ts        ← GET + PATCH do perfil
  admin/questoes/import/route.ts  ← POST, importa JSON de questões
  admin/concursos/route.ts        ← GET lista de concursos

lib/
  utils/selecionar-questoes.ts    ← lógica de seleção de questões (3 buckets)
  schemas/questao.ts              ← schemas Zod de questões
```

---

## Schema do Banco de Dados (Supabase)

```sql
-- Concursos cadastrados no sistema
CREATE TABLE concursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,     -- ex: "sedf-2026", "abin-2018"
  nome text NOT NULL,
  banca text,
  ano int,
  created_at timestamptz DEFAULT now()
);

-- Perfil de usuário
CREATE TABLE usuarios (
  id uuid PRIMARY KEY,           -- mesmo UUID do Supabase Auth
  email text UNIQUE NOT NULL,
  nome text NOT NULL,
  telefone text,
  concurso_ativo uuid REFERENCES concursos(id),  -- ← SERÁ SUBSTITUÍDO (ver Melhoria 2)
  preferencia_envio text DEFAULT 'ambos',         -- 'whatsapp_direto' | 'link_site' | 'ambos'
  notificacoes_ativas boolean DEFAULT true,
  horario_inicio time,
  horario_fim time,
  envios_por_dia int DEFAULT 2,
  perguntas_por_envio int DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

-- Questões do banco
CREATE TABLE questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,            -- 'verdadeiro_falso' | 'multipla_escolha' | 'redacao'
  enunciado text NOT NULL,
  resposta_correta text,         -- letra (MC) ou null (VF usa boolean abaixo)
  resposta_correta_boolean boolean,  -- true/false para VF
  alternativas jsonb,            -- [{letra, texto}] para MC
  explicacao text,
  disciplina text,
  assunto text,
  nivel text,                    -- 'basico' | 'intermediario' | 'avancado'
  ativo boolean DEFAULT true,
  limite_linhas_min int,
  limite_linhas_max int,
  criterios_avaliacao jsonb,
  fonte text,
  tags jsonb,
  created_at timestamptz DEFAULT now()
);

-- Relacionamento N:N entre questões e concursos
CREATE TABLE questao_concurso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  concurso_id uuid REFERENCES concursos(id) ON DELETE CASCADE,
  UNIQUE (questao_id, concurso_id)
);

-- Respostas dos usuários
CREATE TABLE respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  resposta text,
  correta boolean,
  nota_redacao numeric,
  feedback_ia jsonb,
  created_at timestamptz DEFAULT now()
);

-- Fila de revisão (prioridade para questões mais erradas)
CREATE TABLE fila_revisao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE CASCADE,
  questao_id uuid REFERENCES questoes(id) ON DELETE CASCADE,
  prioridade int DEFAULT 1,      -- incrementa a cada erro, máximo 10
  atualizada_em timestamptz DEFAULT now(),
  UNIQUE (usuario_id, questao_id)
);
```

**View importante:**
```sql
-- Questões priorizadas para revisão (usada em selecionar-questoes.ts)
CREATE VIEW vw_questoes_prioritarias AS
SELECT f.usuario_id, f.prioridade, f.atualizada_em, q.*
FROM fila_revisao f
JOIN questoes q ON q.id = f.questao_id
WHERE q.ativo = TRUE
ORDER BY f.prioridade DESC, f.atualizada_em ASC;
```

**Trigger automático:** toda resposta inserida na tabela `respostas` dispara `atualiza_fila_revisao()`, que incrementa a prioridade se errou ou remove da fila se acertou.

---

## Schema Zod das Questões (lib/schemas/questao.ts)

O JSON de importação segue este formato:

```typescript
// Questão V/F
{ tipo: 'verdadeiro_falso', enunciado: string, resposta_correta: boolean,
  disciplina?, assunto?, nivel?, explicacao?, concursos?: string[], fonte?, tags? }

// Questão MC
{ tipo: 'multipla_escolha', enunciado: string, resposta_correta: string,
  alternativas: [{letra: string, texto: string}],
  disciplina?, assunto?, nivel?, explicacao?, concursos?: string[], fonte?, tags? }

// Questão Redação
{ tipo: 'redacao', enunciado: string, resposta_correta: null | undefined,
  criterios_avaliacao: string[],
  limite_linhas_min?: number, limite_linhas_max?: number,
  disciplina?, assunto?, nivel?, concursos?: string[] }
```

**Payload completo de importação:**
```json
{
  "metadata": { "fonte": "Apostila SEDF 2026", "banca": ["Quadrix"], "total_questoes": 190 },
  "concursos_sugeridos": [
    { "slug": "sedf-2026", "nome": "SEDF - Professor 2026", "banca": "Quadrix", "ano": 2026 }
  ],
  "questoes": [ ...array de questões... ]
}
```

A API `POST /api/admin/questoes/import` cria automaticamente os concursos listados em `concursos_sugeridos` se não existirem, e faz o relacionamento via `questao_concurso`.

---

## Lógica de Seleção de Questões (lib/utils/selecionar-questoes.ts)

O sistema usa 3 buckets:
- **60% revisão**: questões com alta prioridade na `fila_revisao` (mais erradas)
- **30% novas**: questões nunca respondidas, filtradas pelo `concurso_ativo` do usuário
- **10% espaçada**: questões acertadas há mais de 3 dias (revisão espaçada)

O filtro por concurso acontece em `novasQuery` via join com `questao_concurso` onde `concurso_id = usuario.concurso_ativo`. Se nenhum concurso ativo, traz questões de qualquer concurso.

---

## Autenticação nas Rotas de API

Rotas autenticadas extraem o token assim:
```typescript
const token = request.headers.get('authorization')?.replace('Bearer ', '').trim();
const { data: userData } = await supabaseAdmin.auth.getUser(token);
const usuarioId = userData.user.id;
```

Rotas admin não têm autenticação especial no momento (acesso livre para admin).

---

---

# MELHORIA 1 — Importação de JSON com Validação Visual Completa

## Situação atual

A página `app/(admin)/admin/importar/page.tsx` já permite:
- Upload de arquivo `.json` ou colar JSON na textarea
- Preview das primeiras 5 questões
- Botão "Importar questões" que chama `POST /api/admin/questoes/import`
- Exibe resultado com contagem de inseridas e lista de erros

**Problema:** Não há validação client-side detalhada antes de importar. Os erros só aparecem após o envio. Arquivos com centenas de questões podem ter erros que só são descobertos depois.

## O que deve ser implementado

### Passo 1 — Validação client-side completa antes da importação

Quando o usuário carrega/cola o JSON, além do preview atual, executar validação Zod em **todas** as questões no browser (importar o schema do servidor ou replicar a lógica). A validação deve ocorrer automaticamente ao carregar o arquivo, sem precisar clicar em nenhum botão.

Mostrar um **painel de diagnóstico** com:
- Total de questões encontradas no arquivo
- Contagem de questões válidas vs inválidas
- Lista expandível de erros com: índice da questão, enunciado (primeiros 60 chars), e motivo do erro detalhado
- Barra de progresso visual (ex: "187 válidas / 3 com erro")
- Indicador visual por tipo: quantas VF, MC, redação
- Identificar os concursos referenciados no campo `concursos[]` de cada questão

**Exemplo de layout do painel:**
```
┌─────────────────────────────────────────────────────┐
│  190 questões carregadas                            │
│  ✅ 187 válidas   ❌ 3 com erro                     │
│  Tipos: 180 V/F · 7 MC · 3 Redação                 │
│  Concursos: sedf-2026 (190 questões)                │
├─────────────────────────────────────────────────────┤
│  ERROS ENCONTRADOS                                  │
│  ▸ Q#8 — "Julgue a assertiva..." → resposta_correta │
│    ausente ou tipo incorreto para verdadeiro_falso  │
│  ▸ Q#45 — "Considerando o texto..." → alternativas  │
│    deve ter ao menos 2 itens                        │
│  ▸ Q#112 — (enunciado ausente) → enunciado é campo  │
│    obrigatório                                      │
└─────────────────────────────────────────────────────┘
```

### Passo 2 — Botão de importação condicional

- Se houver erros: botão "Importar questões válidas (187)" em cor de aviso (warning), com checkbox "Pular questões com erro e importar apenas as válidas"
- Se não houver erros: botão "Importar todas (190)" em azul (primary)
- Ambos os modos devem funcionar — o modo "apenas válidas" filtra client-side antes de enviar

### Passo 3 — Resultado pós-importação melhorado

Após importar, mostrar:
- Quantas foram inseridas com sucesso
- Quais concursos foram criados automaticamente (já existe)
- Lista de erros retornados pela API (já existe mas pode ser melhorada com o enunciado da questão)

### Arquivos a modificar

- `app/(admin)/admin/importar/page.tsx` — toda a lógica de validação e UI
- Não é necessário alterar a API (`app/api/admin/questoes/import/route.ts`)

### Observações técnicas

A validação Zod não pode ser importada diretamente no client component pois `lib/schemas/questao.ts` usa imports do servidor. Replicar a lógica de validação no próprio componente como função JavaScript pura (sem Zod), ou usar `typeof window !== 'undefined'` com import dinâmico. Alternativamente, criar um endpoint `POST /api/admin/questoes/validar` que recebe o payload e retorna os erros sem inserir nada (dry-run).

---

---

# MELHORIA 2 — Provas Ativas (multi-select substituindo Concurso Ativo)

## Situação atual

O campo `concurso_ativo` na tabela `usuarios` é uma FK simples para um único concurso. O usuário só pode selecionar **uma** prova ativa. As questões são filtradas por esse único concurso.

## O que deve ser implementado

### Passo 1 — Migração do banco de dados

Adicionar nova coluna na tabela `usuarios` para suportar múltiplos concursos:

```sql
-- Adicionar coluna de array de UUIDs (mantém concurso_ativo por compatibilidade)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS concursos_ativos uuid[] DEFAULT '{}';

-- Popular com os dados existentes (quem tinha concurso_ativo ativo)
UPDATE usuarios SET concursos_ativos = ARRAY[concurso_ativo]
WHERE concurso_ativo IS NOT NULL;
```

A coluna `concurso_ativo` pode ser mantida no banco por ora, mas o sistema deve parar de usá-la para filtrar questões. Todo o código deve migrar para `concursos_ativos`.

Executar o SQL acima no painel do Supabase (SQL Editor).

### Passo 2 — API de perfil (app/api/usuarios/perfil/route.ts)

**GET:** Incluir `concursos_ativos` no select:
```typescript
.select('id, nome, email, telefone, concurso_ativo, concursos_ativos, preferencia_envio, ...')
```

**PATCH:** Atualizar schema Zod para aceitar o novo campo:
```typescript
const perfilUpdateSchema = z.object({
  // ... campos existentes ...
  concursos_ativos: z.array(z.string().uuid()).optional()
});
```

### Passo 3 — Lógica de seleção (lib/utils/selecionar-questoes.ts)

Substituir o filtro por `concurso_ativo` (single) pelo filtro por `concursos_ativos` (array):

```typescript
// Antes:
const { data: usuario } = await supabase
  .from('usuarios')
  .select('concurso_ativo')
  .eq('id', usuarioId)
  .single();
const concursoAtivo = usuario?.concurso_ativo ?? null;

// Depois:
const { data: usuario } = await supabase
  .from('usuarios')
  .select('concursos_ativos')
  .eq('id', usuarioId)
  .single();
const concursosAtivos: string[] = usuario?.concursos_ativos ?? [];
```

No Bucket 2 (questões novas), alterar o filtro:

```typescript
// Antes: filtra por 1 concurso
if (concursoAtivo) {
  const { data: questaosConcurso } = await supabase
    .from('questao_concurso').select('questao_id')
    .eq('concurso_id', concursoAtivo);
  ...
}

// Depois: filtra por qualquer dos concursos selecionados
if (concursosAtivos.length > 0) {
  const { data: questaosConcurso } = await supabase
    .from('questao_concurso').select('questao_id')
    .in('concurso_id', concursosAtivos);
  const idsNoConcurso = (questaosConcurso ?? []).map(qc => qc.questao_id);
  if (idsNoConcurso.length > 0) {
    novasQuery = novasQuery.in('id', idsNoConcurso);
  }
}
```

### Passo 4 — Tela de Configurações (app/(auth)/configuracoes/page.tsx)

Substituir o `<select>` de concurso único por um **multi-select com checkboxes**:

- Label: **"Provas ativas"** (não mais "Concurso ativo")
- Exibir lista de todos os concursos disponíveis como checkboxes
- Cada checkbox mostra: `{nome} — {banca} ({ano})`
- Usuário pode marcar quantos quiser
- Abaixo da lista: texto explicativo "As questões serão selecionadas de todas as provas marcadas"
- Se nenhuma prova selecionada: questões de qualquer concurso são incluídas

**Estado no componente:**
```typescript
// Substituir:
concurso_ativo: string | null;
// Por:
concursos_ativos: string[];  // array de UUIDs
```

**Envio no handleSubmit:**
```typescript
body: JSON.stringify({
  // remover concurso_ativo
  concursos_ativos: perfil.concursos_ativos,
  // ... outros campos
})
```

### Passo 5 — Tela de Cadastro (app/(public)/cadastro/page.tsx)

Substituir o `<select>` de concurso único por multi-select com checkboxes (mesmo padrão das configurações).

- Label: **"Provas ativas"** com texto auxiliar: "Você pode alterar isso depois em Configurações"
- Estado: `concursosAtivos: string[]` (array de IDs)
- Enviar no body como `concursos_ativos: concursosAtivos`

### Passo 6 — API de cadastro (app/api/auth/cadastro/route.ts)

Atualizar schema Zod para aceitar o novo campo:

```typescript
const cadastroSchema = z.object({
  // remover: concurso_ativo
  // adicionar:
  concursos_ativos: z.array(z.string().uuid()).optional().default([]),
  // ... outros campos
});
```

E no insert da tabela `usuarios`:
```typescript
await supabaseAdmin.from('usuarios').insert({
  // remover: concurso_ativo,
  concursos_ativos: concursos_ativos,
  // ... outros campos
});
```

---

---

# MELHORIA 3 — Quantidade de Questões Configurável na Sessão de Estudo

## Situação atual

Em `app/(auth)/estudar/page.tsx`, a chamada à API está **hardcoded** com `limit=5`:

```typescript
const response = await fetch('/api/questoes/proximas?limit=5', { ... });
```

A API `app/api/questoes/proximas/route.ts` já aceita o parâmetro `limit` e suporta até 20:
```typescript
const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 5), 1), 20);
```

## O que deve ser implementado

### Passo 1 — Aumentar o limite da API

Alterar o máximo de 20 para 50 em `app/api/questoes/proximas/route.ts`:

```typescript
// Antes:
const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 5), 1), 20);

// Depois:
const limit = Math.min(Math.max(Number(searchParams.get('limit') ?? 10), 1), 50);
```

### Passo 2 — Seletor de quantidade na tela de Estudar

Em `app/(auth)/estudar/page.tsx`, adicionar um seletor de quantidade **no cabeçalho da página**, ao lado do botão "Nova rodada".

**Opções de quantidade:** 5, 10, 15, 20, 30, 50  
**Padrão:** 10 (não mais 5)

Layout sugerido para o cabeçalho:
```
[h1: Estudar]   [select: 10 questões ▾]   [btn: ↺ Nova rodada]
```

**Implementação:**
```typescript
const [quantidade, setQuantidade] = useState(10);

// No fetch:
const response = await fetch(`/api/questoes/proximas?limit=${quantidade}`, { ... });

// No JSX — seletor:
<select
  className="form-select form-select-sm"
  style={{ width: 'auto' }}
  value={quantidade}
  onChange={(e) => setQuantidade(Number(e.target.value))}
>
  {[5, 10, 15, 20, 30, 50].map(n => (
    <option key={n} value={n}>{n} questões</option>
  ))}
</select>
```

Quando o usuário alterar a quantidade e clicar em "Nova rodada", a próxima sessão usa a quantidade selecionada. A quantidade **não** muda a sessão em andamento (só aplica na próxima rodada).

### Passo 3 — Mostrar progresso mais claro

Com sessões maiores (30, 50 questões), o indicador `X / Y` no card já existe mas pode ser complementado com uma barra de progresso acima do card:

```html
<div class="progress mb-3" style="height: 6px">
  <div class="progress-bar bg-primary" style="width: {(currentIndex/questoes.length)*100}%"></div>
</div>
```

---

---

# Resumo das Mudanças por Arquivo

| Arquivo | Melhoria | Tipo de mudança |
|---|---|---|
| `app/(admin)/admin/importar/page.tsx` | 1 | Reescrita completa da UI de validação |
| `app/(auth)/estudar/page.tsx` | 3 | Adicionar seletor de quantidade + barra de progresso |
| `app/(auth)/configuracoes/page.tsx` | 2 | Trocar select único por multi-select checkboxes |
| `app/(public)/cadastro/page.tsx` | 2 | Trocar select único por multi-select checkboxes |
| `app/api/usuarios/perfil/route.ts` | 2 | Adicionar `concursos_ativos` ao schema e queries |
| `app/api/auth/cadastro/route.ts` | 2 | Adicionar `concursos_ativos` ao schema e insert |
| `app/api/questoes/proximas/route.ts` | 3 | Aumentar limite máximo de 20 para 50 |
| `lib/utils/selecionar-questoes.ts` | 2 | Filtrar por array de concursos em vez de um só |
| **Supabase SQL** | 2 | `ALTER TABLE usuarios ADD COLUMN concursos_ativos uuid[]` |

---

# Ordem de Execução Recomendada

1. **Banco de dados primeiro** — rodar o `ALTER TABLE` no Supabase SQL Editor
2. **Melhoria 3** — mais simples, sem dependências de banco
3. **Melhoria 1** — autônoma, só frontend + API existente
4. **Melhoria 2** — maior impacto, requer banco + múltiplas APIs + múltiplas telas

---

# Comportamento Esperado Após as Melhorias

- **Admin importa JSON** → vê painel de diagnóstico imediato com erros detalhados por questão → decide importar todas ou só as válidas
- **Usuário no cadastro** → seleciona múltiplas provas com checkboxes → questões de todas as provas marcadas aparecem na sessão de estudo
- **Usuário em Configurações** → pode ajustar quais provas quer estudar a qualquer momento
- **Usuário em Estudar** → seleciona quantas questões quer na sessão (padrão 10) → vê barra de progresso durante a sessão
