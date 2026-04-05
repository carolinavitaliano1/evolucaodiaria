

## Plano: Módulo Financeiro de Grupo com Toggle e Contabilização Individual

### Problema Atual
1. A aba "Financeiro" do grupo está sempre visível, mesmo quando o grupo não é pago
2. Evoluções de grupo (com `group_id`) não são contabilizadas no financeiro individual do paciente

### Solução

#### 1. Toggle para habilitar/desabilitar financeiro no grupo

**Migração DB**: Adicionar coluna `financial_enabled` (boolean, default false) na tabela `therapeutic_groups`.

**GroupDetail.tsx**:
- Na aba "Informações", adicionar um Switch "Habilitar módulo financeiro" que atualiza `financial_enabled` no banco
- Condicionar a exibição da aba "Financeiro" no array `tabs` ao valor de `group.financial_enabled`
- Quando habilitado, mostrar campo para editar `default_price` (valor por sessão do grupo)

#### 2. Evoluções de grupo contabilizadas no financeiro individual

**Financial.tsx** (página financeira global):
- Atualmente `calculatePatientRevenue` filtra `monthlyEvolutions` por `patientId` e status faturável — isso já inclui evoluções com `group_id` pois são salvas com o `patient_id` do membro
- Verificar se o `default_price` do grupo é usado como valor da sessão quando a evolução tem `group_id`
- Lógica: se evolução tem `group_id`, usar o `default_price` do grupo como valor; se não, usar o `paymentValue` do paciente

**AppContext.tsx / mapEvolution**:
- Garantir que `group_id` é mapeado no objeto `Evolution` para que possa ser utilizado na lógica de cálculo

**ClinicFinancial.tsx**:
- Mesma lógica: ao calcular receita por paciente, considerar evoluções de grupo com o valor do grupo

### Detalhes Técnicos

**Migração SQL:**
```sql
ALTER TABLE public.therapeutic_groups 
ADD COLUMN financial_enabled boolean DEFAULT false;
```

**Lógica de receita (Financial.tsx):**
```typescript
// Para cada evolução faturável do paciente:
// - Se tem group_id → usar default_price do grupo
// - Se não → usar paymentValue do paciente (lógica atual)
```

**Tipo Evolution (types/index.ts):**
- Adicionar campo `groupId?: string` ao interface `Evolution`

### Arquivos a Editar
1. **Migração** — adicionar `financial_enabled` à tabela `therapeutic_groups`
2. **src/types/index.ts** — adicionar `groupId` ao `Evolution`
3. **src/contexts/AppContext.tsx** — mapear `group_id` no `mapEvolution`
4. **src/pages/GroupDetail.tsx** — toggle do financeiro + condicionar aba
5. **src/pages/Financial.tsx** — carregar preços de grupos e usar na receita quando evolução tem `group_id`
6. **src/components/clinics/ClinicFinancial.tsx** — mesma lógica de grupo no financeiro da clínica

