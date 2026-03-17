

## Diagnóstico — Raiz dos 3 problemas

### 1. Mural (feed_posts) — paciente não vê posts
- `feed_posts` **não está na publicação Realtime** (apenas `portal_messages` está)
- A RLS para SELECT do paciente existe (`is_portal_patient`), mas como não há Realtime para `feed_posts`, a página `PortalMural` faz apenas um `loadPosts()` inicial e nunca atualiza quando o terapeuta publica

### 2. Mensagens — não atualiza em tempo real
- `portal_messages` está na publicação Realtime ✅
- Mas o `PortalContext` cria o canal de realtime com `filter: patient_id=eq.${patientId}` — isso exige que a tabela tenha **replica identity FULL** ou que o filtro seja suportado; sem isso o Supabase Realtime não dispara

### 3. Avisos (portal_notices) — não atualiza
- `portal_notices` **não está na publicação Realtime**
- `PortalNotices.tsx` faz apenas uma query no `useEffect` inicial sem nenhum listener — quando o terapeuta cria um aviso, o paciente só vê se recarregar a página

---

## Plano de Correção

### Banco de dados (migration)
1. Adicionar `feed_posts`, `feed_comments`, `feed_reactions` e `portal_notices` à publicação `supabase_realtime`
2. Habilitar `REPLICA IDENTITY FULL` em `portal_messages` para garantir que filtros de realtime funcionem

### Código

**`PortalContext.tsx`** — já tem realtime para `portal_messages`, mas precisa funcionar com a nova configuração

**`PortalNotices.tsx`** — adicionar assinatura Realtime para `portal_notices` + polling de fallback ao montar a página

**`PatientFeed.tsx`** (usado no `PortalMural`) — adicionar assinatura Realtime para `feed_posts` para recarregar quando terapeuta publicar

```text
Fluxo corrigido:

Terapeuta publica post
    └─> INSERT em feed_posts
         └─> Realtime dispara
              └─> PatientFeed recarrega posts automaticamente
              └─> badge "Mural" atualiza via portal_notices

Terapeuta envia mensagem
    └─> INSERT em portal_messages
         └─> Realtime dispara (REPLICA IDENTITY FULL)
              └─> PortalContext.loadMessages() executa
              └─> Chat atualiza sem recarregar

Terapeuta cria aviso
    └─> INSERT em portal_notices
         └─> Realtime dispara
              └─> PortalNotices recarrega lista
              └─> badge "Avisos" atualiza
```

### Arquivos que serão alterados
- `supabase/migrations/` — nova migration para publicação Realtime + REPLICA IDENTITY
- `src/components/feed/PatientFeed.tsx` — adicionar Realtime subscription em `feed_posts`
- `src/pages/portal/PortalNotices.tsx` — adicionar Realtime subscription em `portal_notices`
- `src/contexts/PortalContext.tsx` — garantir canal de mensagens robusto com status callback

