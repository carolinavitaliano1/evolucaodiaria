

## Problema

Ao fazer login com Google na Vercel, o Supabase redireciona para `https://clinipro.lovable.app/auth` em vez de voltar para o dominio da Vercel. Isso acontece porque a **Site URL** configurada no backend e `clinipro.lovable.app`, e o parametro `redirectTo` com apenas `window.location.origin` nao esta sendo respeitado.

## Solucao

Alterar o `redirectTo` no fluxo OAuth para incluir o caminho completo (`/dashboard`) e garantir que a URL completa seja reconhecida pela allow list.

## Alteracoes tecnicas

### 1. `src/pages/Auth.tsx`

Atualizar a funcao `handleGoogleOAuth` para usar o caminho completo no `redirectTo`:

```typescript
const handleGoogleOAuth = async () => {
  if (isLovableDomain()) {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error('Erro ao entrar com Google');
  } else {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) toast.error('Erro ao entrar com Google');
  }
};
```

### 2. Configuracao obrigatoria na URI Allow List (Lovable Cloud)

Voce precisa garantir que estas URLs estejam na **URI Allow List** (Users -> Authentication Settings):

- `https://evolucaodiaria.vercel.app`
- `https://evolucaodiaria.vercel.app/**`
- `https://evolucaodiaria.vercel.app/dashboard`

### 3. Configuracao no Google Cloud Console

Em **Authorized redirect URIs**, confirme que existe:

- `https://uhhpnjyceobdcxqviouy.supabase.co/auth/v1/callback`

---

Essas mudancas garantem que apos o callback do Google, o usuario sera redirecionado para `/dashboard` no dominio da Vercel em vez de voltar para o dominio do Lovable.

