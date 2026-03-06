
## Diagnóstico completo dos problemas da equipe

### Problema 1 — E-mails não chegam (causa raiz confirmada nos logs)
O Resend retorna erro 403: a chave configurada pertence à conta `carolinavitaliano1@gmail.com` mas o domínio de envio não está verificado no Resend. No plano gratuito do Resend, sem domínio verificado, só é possível enviar para o próprio e-mail da conta.

**Solução**: Para usuário existente (que já tem conta), usar `inviteUserByEmail` do Supabase Auth (que funciona via auth-email-hook com o domínio `notify.evolucaodiaria.app.br` já configurado), em vez de tentar o Resend. Para usuário novo, já está usando `inviteUserByEmail` corretamente.

### Problema 2 — `listUsers()` não escala e pode falhar
A função `invite-member` chama `supabase.auth.admin.listUsers()` que retorna **todos** os usuários do sistema de uma vez para encontrar se o e-mail já tem conta. Isso não escala e pode retornar paginação incompleta.

**Solução**: Usar `getUserByEmail` ou buscar direto na tabela `profiles` por e-mail.

### Problema 3 — URL do convite usa `onboarding@resend.dev` com nome "CliniPro"
O e-mail enviado via Resend ainda referencia "CliniPro" no corpo e no remetente, mas o app agora se chama "Evolução Diária".

### Problema 4 — `invite-member` não está em `config.toml` com `verify_jwt = false`
A função `invite-member` não está listada no `config.toml`, o que pode causar falhas de autenticação dependendo da configuração padrão.

### Problema 5 — Fluxo de aceite do convite no Auth.tsx
Quando o usuário clica no link de convite e já está logado, o `accept-invite` é chamado antes do redirect. Mas se o usuário ainda não tem conta, o fluxo de criação de conta deve ativar o membro automaticamente após signup.

---

## Plano de correção

### 1. Reescrever `supabase/functions/invite-member/index.ts`

**Nova lógica unificada**:
- Buscar usuário existente via `profiles` (por e-mail) em vez de `listUsers()`
- Para qualquer caso (usuário novo ou existente): usar **sempre** `supabase.auth.admin.inviteUserByEmail()` — isso usa o auth-email-hook com domínio próprio verificado (`notify.evolucaodiaria.app.br`), que já está funcionando
- Remover completamente a dependência do Resend para convites de equipe (o Resend fica só para outros fins)
- Corrigir o `appUrl` para sempre usar `https://evolucaodiaria.app.br` em vez de depender do `origin` header

### 2. Adicionar `invite-member` ao `supabase/config.toml`
```toml
[functions.invite-member]
  verify_jwt = false
[functions.accept-invite]
  verify_jwt = false
```

### 3. Corrigir `src/pages/Auth.tsx` — fluxo de aceite
Quando usuário novo se cadastra com link de convite (`?invite=...&org=...`), após o signup ele deve ser redirecionado para aceitar o convite automaticamente, sem precisar clicar novamente.

### 4. Deploy da função atualizada

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/invite-member/index.ts` | Reescrever para usar auth-email-hook em vez do Resend |
| `supabase/config.toml` | Adicionar `invite-member` e `accept-invite` com `verify_jwt = false` |
| `src/pages/Auth.tsx` | Melhorar fluxo de aceite de convite pós-signup |

O resultado: convites chegarão pelo e-mail do domínio `notify.evolucaodiaria.app.br` (já verificado e funcionando), o link levará para a página de login/cadastro com o convite pré-carregado, e ao entrar/criar conta o membro será ativado automaticamente na equipe.
