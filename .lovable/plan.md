## Objetivo
Adicionar uma seção avançada **"Financeiro e Comissionamento"** ao modal de criação/edição de Pacotes da Clínica (`ClinicPackagesPanel.tsx`), com regras flexíveis de lançamento financeiro, comissões e atribuição de profissionais (suportando múltiplos profissionais com regras distintas).

---

## Alterações no Banco de Dados

### 1. Adicionar colunas em `clinic_packages`
- `lancamento_tipo` (text) — `'valor_total'` | `'valor_procedimento'` (default `'valor_total'`)
- `valor_total` (numeric) — valor financeiro do lançamento
- `account_id` (uuid) — FK lógica para a conta/caixa de destino
- `commission_payment_method` (text) — `'sem_comissao'` | `'integral'` | `'por_atendimento'` (default `'sem_comissao'`)
- `commission_type` (text) — `'valor_fixo'` | `'porcentagem'` (default `'valor_fixo'`)
- `commission_per_professional` (boolean) — toggle "comissão diferente por profissional" (default `false`)

### 2. Criar tabela auxiliar `package_commissions`
Para suportar múltiplos profissionais com regras distintas:
- `id`, `package_id` (FK clinic_packages), `member_id` (FK organization_members), `commission_value` (numeric), `commission_type` (text — herda ou sobrescreve), `created_at`, `updated_at`
- RLS: dono do pacote (via `clinic_packages.user_id`) e membros da org da clínica podem ler; apenas dono/admins podem escrever.

### 3. Reusar `accounts` (caixa)
Verificar se já existe tabela de contas/caixas no projeto. Se não existir, usar um `Input` simples de texto livre `account_name` (campo string) em vez de FK — para evitar criar uma feature inteira nova de "contas". **Decisão proposta:** usar campo texto `account_name` por simplicidade, marcando como obrigatório no form.

---

## Alterações no Frontend

### 1. `src/types/index.ts`
Adicionar campos à interface `ClinicPackage`:
```ts
lancamentoTipo?: 'valor_total' | 'valor_procedimento';
valorTotal?: number;
accountName?: string;
commissionPaymentMethod?: 'sem_comissao' | 'integral' | 'por_atendimento';
commissionType?: 'valor_fixo' | 'porcentagem';
commissionPerProfessional?: boolean;
commissions?: PackageCommission[];
```
Nova interface `PackageCommission { id, packageId, memberId, commissionValue, commissionType }`.

### 2. `src/contexts/AppContext.tsx`
Mapear novas colunas snake_case ↔ camelCase em `addPackage`/`updatePackage`. Carregar `package_commissions` junto com pacotes.

### 3. Novo componente `src/components/clinics/PackageFormDialog.tsx`
Extrair os modais "Novo Pacote" e "Editar Pacote" (atualmente duplicados em `ClinicPackagesPanel.tsx`) para um único componente reutilizável com:

- **React Hook Form + Zod** para validação
- Schema Zod garantindo: `name`, `valorTotal`, `accountName` obrigatórios; comissões com `memberId` + `commissionValue` quando `commissionPaymentMethod !== 'sem_comissao'`
- **Layout em Cards** (shadcn `Card`) agrupando:
  - Card 1: Dados básicos (nome, descrição, tipo, sessões)
  - Card 2: **Lançamento Financeiro** — RadioGroup (valor total / valor procedimento), Input "Valor total (R$)*", Input "Conta*"
  - Card 3: **Comissão** — Select forma de pagamento (com texto de ajuda "Um lançamento de comissão será gerado a cada atendimento" se `por_atendimento`), RadioGroup tipo (fixo/%), Switch "comissão diferente por profissional"
  - Card 4: **Profissionais** — bloco dinâmico (repeater via `useFieldArray`):
    - Se toggle OFF → 1 bloco fixo (Profissional + Comissão)
    - Se toggle ON → lista com botão "+ Adicionar outro profissional" e remover
    - Prefixo do input muda dinamicamente: `R$` ou `%` conforme `commissionType`
    - Texto-resumo dinâmico: *"Será lançado o valor de R$ X a cada atendimento que o profissional fizer para este pacote."*
  - Select de profissional busca membros via `useApp().orgMembers` filtrando ativos da org da clínica

### 4. Refatorar `ClinicPackagesPanel.tsx`
Substituir os dois `<Dialog>` inline pelo novo `<PackageFormDialog mode="create"|"edit" pkg={...} />`. Remover state local duplicado.

### 5. Persistência
Após salvar pacote, sincronizar `package_commissions` (delete-all + insert atual) na mesma transação lógica via novo método `setPackageCommissions(packageId, commissions[])` no `AppContext`.

---

## Validação Zod (esquema resumido)

```ts
const commissionSchema = z.object({
  memberId: z.string().uuid('Selecione um profissional'),
  commissionValue: z.number().positive('Valor obrigatório'),
});

const packageSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100),
  description: z.string().max(500).optional(),
  packageType: z.enum(['mensal','por_sessao','personalizado']),
  sessionLimit: z.number().int().positive().optional(),
  lancamentoTipo: z.enum(['valor_total','valor_procedimento']),
  valorTotal: z.number().positive('Valor total obrigatório'),
  accountName: z.string().trim().min(1, 'Conta obrigatória'),
  commissionPaymentMethod: z.enum(['sem_comissao','integral','por_atendimento']),
  commissionType: z.enum(['valor_fixo','porcentagem']),
  commissionPerProfessional: z.boolean(),
  commissions: z.array(commissionSchema),
}).refine(d => d.commissionPaymentMethod === 'sem_comissao' || d.commissions.length > 0, {
  message: 'Adicione ao menos um profissional',
  path: ['commissions'],
});
```

---

## Arquivos Afetados

**Novos:**
- `src/components/clinics/PackageFormDialog.tsx`
- Migration SQL (colunas + tabela `package_commissions` + RLS)

**Editados:**
- `src/types/index.ts` — interfaces
- `src/contexts/AppContext.tsx` — mapeamento + CRUD de commissions
- `src/components/clinics/ClinicPackagesPanel.tsx` — usar novo dialog

---

## Pontos a Confirmar

1. **Conta/Caixa:** Usar campo de texto livre `accountName` (proposto) **ou** você quer que eu crie uma tabela `accounts` real com CRUD próprio? Criar tabela `accounts` aumentaria o escopo significativamente.
2. **Lista de profissionais:** Usar `organization_members` (membros da equipe da org da clínica). OK?
3. **Pacotes existentes:** Os pacotes já criados ficarão sem essas configs (campos opcionais/null). OK não migrar dados antigos?
