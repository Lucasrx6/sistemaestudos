# Guia de Testes Manuais

## Setup antes de testar

1. Rode `supabase/schema.sql` no painel SQL do Supabase
2. Preencha `.env.local` com todas as variáveis de `.env.example`
3. `npm install && npm run dev`

---

## 1. Autenticação

### 1.1 Cadastro
- Acesse `/cadastro`
- Preencha todos os campos; o select de concurso deve listar concursos cadastrados
- Submeta → deve redirecionar para `/login` sem erros
- **Verifique** no Supabase: tabela `usuarios` deve ter o novo registro

### 1.2 Login
- Acesse `/login` com as credenciais criadas → deve redirecionar para `/dashboard`
- Credencial errada → deve mostrar erro

### 1.3 Proteção de rotas
- `/dashboard` sem login → redireciona para `/login`
- `/admin/questoes` sem ser admin → mostra "Acesso negado"

---

## 2. Admin — Concursos

- Acesse `/admin/concursos` com o email de admin
- Crie, edite e exclua concursos
- **Verifique** na tabela `concursos` do Supabase

---

## 3. Admin — Questões

### 3.1 Verdadeiro/Falso
- Tipo: Verdadeiro/Falso → preencha enunciado, disciplina, resposta correta → Salve

### 3.2 Múltipla Escolha
- Tipo: Múltipla escolha → adicione 4 alternativas, selecione a correta → Salve

### 3.3 Redação
- Tipo: Redação → preencha linhas mínimas, máximas, critérios → Salve

### 3.4 Editar e excluir
- Editar deve pré-preencher todos os campos no modal
- Excluir com confirmação deve remover da tabela

---

## 4. Admin — Importação em massa

- Acesse `/admin/importar`
- Cole ou faça upload do `questoes_exemplo.json`
- Preview deve mostrar as primeiras 5 questões
- Clique em "Importar" → deve mostrar N inseridas, 0 erros
- **Verifique** tabela `questoes` e `questao_concurso` no Supabase

---

## 5. Estudar

- Acesse `/estudar`; deve carregar questões priorizadas
- V/F: selecione → Responder → mostra ✓ ou ✗ com explicação → Próxima
- Múltipla escolha: selecione alternativa → Responder
- Pular: skip avança sem salvar resposta
- Fim da rodada: tela de conclusão com botão "Nova rodada"
- **Verifique**: tabela `respostas` com novos registros
- **Verifique**: trigger atualizou `fila_revisao` para questões erradas

---

## 6. Redação

- Acesse `/redacao`
- Digite disciplina → "Gerar novo tema" → deve aparecer estrutura completa
- Escreva a redação → "Enviar para correção"
- Resultado: nota 0–10, critérios, pontos fortes/melhorar, correções específicas

---

## 7. Dashboard

- Acesse `/dashboard` após responder algumas questões
- Cards devem mostrar valores reais
- Gráfico de barras reflete atividade dos últimos 14 dias
- Lista "Mais erradas" mostra questões com mais erros

---

## 8. Estatísticas

- Taxa por disciplina com barras de progresso
- Top questões mais erradas com contagem
- Heatmap 90 dias: verde ≥70%, amarelo 40–69%, vermelho <40%

---

## 9. Configurações

- Dados pré-preenchidos ao abrir
- Altere telefone, horários, sliders → Salvar
- **Verifique** no banco: tabela `usuarios` atualizada
- Recarregue → valores devem persistir

---

## 10. Responder via Token (link WhatsApp)

```bash
curl -X POST http://localhost:3000/api/whatsapp/enviar \
  -H "Content-Type: application/json" \
  -d '{"usuario_id": "uuid-do-usuario"}'
```

- Copie o `token` da resposta
- Acesse `/responder/{token}` → questões devem aparecer
- Responda → resultado com acertos/erros
- **Verifique** no banco: respostas com `usuario_id` correto

---

## 11. Webhook WhatsApp (simulação)

```bash
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
      "message": { "conversation": "1V 2A 3F" }
    }
  }'
```

Esperado: `{ "ok": true, "acertos": N, "erros": N }`

---

## 12. Cron de envios (simulação)

```bash
curl -H "Authorization: Bearer SEU_CRON_SECRET" http://localhost:3000/api/cron/envios
```

Esperado: `{ "ok": true, "processados": N, "resultados": [...] }`

---

## 13. Segurança

- [ ] `/api/stats` sem token → 401
- [ ] `/api/stats` com token inválido → 401
- [ ] `/admin/questoes` não-admin → "Acesso negado"
- [ ] Token de envio expirado → 410
- [ ] RLS: usuário A não vê respostas do usuário B

---

## Checklist geral

- [ ] `npm run build` sem erros
- [ ] `npx tsc --noEmit` sem erros
- [ ] `schema.sql` aplicado sem erros no Supabase
- [ ] Trigger `trigger_atualiza_fila_revisao` ativo
- [ ] View `vw_questoes_prioritarias` retorna `usuario_id`
- [ ] Groq API respondendo (GROQ_API_KEY válida)
- [ ] Evolution API configurada e instância ativa
- [ ] Cron configurado no Vercel com `CRON_SECRET`
