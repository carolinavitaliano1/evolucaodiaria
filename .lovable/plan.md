
## Diagnóstico

O domínio `evolucaodiaria.app.br` está **verificado no Resend**. O único problema que impedia o envio de e-mails para usuários existentes era o campo `from` da chamada Resend ainda usando `onboarding@resend.dev` — o endereço padrão do Resend que só funciona para o próprio e-mail da conta.

### Correção necessária

**`supabase/functions/invite-member/index.ts`** — linha 59:

Mudar:
```
from: `Evolução Diária <onboarding@resend.dev>`,
```

Para:
```
from: `Evolução Diária <noreply@evolucaodiaria.app.br>`,
```

Também vou atualizar o template do e-mail de convite via Resend para garantir que o template de convite via `auth-email-hook` (para usuários novos) também exiba as informações corretas do convidante e da organização — atualmente o template `invite.tsx` exibe texto genérico sem mencionar quem convidou ou qual equipe.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/invite-member/index.ts` | Mudar `from` para `noreply@evolucaodiaria.app.br` |
| `supabase/functions/_shared/email-templates/invite.tsx` | Melhorar template com nome do convidante, organização e cargo |
