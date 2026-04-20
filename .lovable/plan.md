

# Plano: Separação de Planos Básico e Pro

## Estrutura dos Planos

| | **Básico — R$ 29,90/mês** | **Pro — R$ 59,90/mês** |
|---|---|---|
| Clínicas, pacientes, agenda | ✅ | ✅ |
| Evoluções (texto livre + templates) | ✅ | ✅ |
| Controle financeiro básico | ✅ | ✅ |
| WhatsApp básico, anexos, notas | ✅ | ✅ |
| **IA (Doc IA, Melhorar Evolução, Feedback IA, Relatórios IA)** | 🔒 | ✅ |
| **Portal do Paciente** (convites, ativações, fichas) | 🔒 | ✅ |
| **Equipe / Multi-profissionais** (convidar membros, conformidade, financeiro de equipe) | 🔒 | ✅ |
| 15 dias grátis | ✅ | ✅ |

Usuários atuais (Mensal/Bimestral/Trimestral) → **mantidos como "Legado" com acesso Pro completo**, sem ação obrigatória.

## Mudanças Técnicas

### 1. Stripe — Novos produtos/preços
- Criar produto **"Básico"** com `price` recorrente mensal R$ 29,90.
- Criar produto **"Pro"** com `price` recorrente mensal R$ 59,90.
- Manter os 3 priceIds antigos ativos (apenas para clientes legados não verem cancelamento).

### 2. Hook `useSubscription`
Adicionar campo derivado `tier: 'basic' | 'pro' | 'legacy' | 'trial' | 'owner' | null` baseado em `productId`:
- Owner email → `pro`
- `trial_until` válido → `pro` (15 dias completos)
- `productId === PRO_PRODUCT_ID` → `pro`
- `productId === BASIC_PRODUCT_ID` → `basic`
- `productId` em lista de IDs antigos → `legacy` (= acesso Pro)

### 3. Edge Function `check-subscription`
Retornar também `tier` calculado server-side (mesma lógica), para consistência.

### 4. Gate de funcionalidades — novo helper `useFeatureAccess()`
```ts
const { hasAI, hasPortal, hasTeam } = useFeatureAccess();
// hasAI = tier !== 'basic'
// hasPortal = tier !== 'basic'  
// hasTeam = tier !== 'basic'
```

### 5. Bloqueio nas telas Básico
Aplicar gate em:
- **Sidebar/MobileNav**: ocultar/lockar links "Equipe", "Doc IA"
- **Página Doc IA**: mostrar tela de upgrade se `!hasAI`
- **Botões "Melhorar com IA"** (evoluções, feedbacks, relatórios): ocultar
- **PatientDetail aba "Portal"**: mostrar CTA de upgrade
- **`send-portal-invite`** edge function: validar tier server-side e recusar se Básico

UI de bloqueio: card centralizado com ícone de cadeado + botão "Fazer upgrade para Pro" → redireciona `/pricing`.

### 6. Página `/pricing` redesenhada
- Layout em 2 cards lado a lado (Básico vs Pro).
- Tabela comparativa de features (✅/❌) abaixo dos cards.
- Badge "Recomendado" no Pro.
- Se usuário já é Básico, botão Pro vira "Fazer upgrade"; se já é Pro, vira "Plano atual".
- Manter banner de 15 dias grátis.

### 7. Página de upgrade rápido
Criar componente `<UpgradeBlock feature="ia" />` reutilizável que renderiza o card de bloqueio + CTA.

## Arquivos a editar/criar

**Editar:**
- `src/pages/Pricing.tsx` — novo layout 2-tier comparativo
- `src/hooks/useSubscription.ts` — adicionar `tier`
- `supabase/functions/check-subscription/index.ts` — retornar `tier`
- `supabase/functions/create-checkout/index.ts` — aceitar novos priceIds
- `supabase/functions/send-portal-invite/index.ts` — validar tier
- `src/pages/DocIA.tsx` — gate de acesso
- `src/components/layout/AppSidebar.tsx` + `MobileNav.tsx` — locks visuais
- `src/components/patients/PortalTab.tsx` — gate
- `src/components/evolutions/FeedbackIAModal.tsx`, `EditEvolutionDialog.tsx` (botão "Melhorar IA") — esconder se Básico

**Criar:**
- `src/hooks/useFeatureAccess.ts` — helper central
- `src/components/UpgradeBlock.tsx` — componente reutilizável de upgrade

## Fluxo de Implementação

```text
1. Criar produtos Básico e Pro no Stripe (live + test)
2. Atualizar hook + edge function (tier)
3. Criar useFeatureAccess + UpgradeBlock
4. Aplicar gates nas páginas (IA, Portal, Equipe)
5. Redesenhar /pricing
6. Testar fluxo: novo signup → Básico → upgrade Pro
```

## O que preciso de você antes de implementar
Os **Price IDs** dos novos planos no Stripe. Posso criá-los automaticamente via tool (R$ 29,90 e R$ 59,90 mensal recorrente, BRL) — confirma que posso seguir?

