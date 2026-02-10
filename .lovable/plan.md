

## Plano de Alteracoes

### 1. Remover Assinatura Digital das Evolucoes

Remover o componente `SignaturePad` de todos os formularios de evolucao:

- **`src/pages/PatientDetail.tsx`**: Remover o campo de assinatura digital do formulario "Nova Evolucao" (linhas ~286-296) e o estado `signature`
- **`src/components/evolutions/EditEvolutionDialog.tsx`**: Remover o campo de assinatura digital do dialog de edicao (linhas ~120-129) e o estado `signature`
- O campo `signature` continuara existindo no banco de dados e no tipo `Evolution` para manter compatibilidade com evolucoes antigas que ja possuem assinatura

### 2. Tipo de Falta Condicional na Clinica

Atualmente a clinica tem apenas `paysOnAbsence` (sim/nao). A ideia e adicionar uma terceira opcao: "depende" - onde a falta so e paga se o paciente confirmou e nao compareceu.

**Alteracao no banco de dados (migracao SQL):**
- Adicionar coluna `absence_payment_type` na tabela `clinics` com valores: `always` (sempre paga), `never` (nunca paga), `confirmed_only` (paga apenas quando paciente confirmou e faltou)
- Manter `pays_on_absence` para compatibilidade, mas a logica usara o novo campo

**Alteracao no tipo `Clinic` (`src/types/index.ts`):**
- Adicionar `absencePaymentType?: 'always' | 'never' | 'confirmed_only'`

**Alteracao na evolucao - campo de confirmacao:**
- Adicionar coluna `confirmed_attendance` (boolean) na tabela `evolutions` - indica se o paciente confirmou presenca antes da sessao
- Adicionar campo no formulario de evolucao quando status = "falta" e a clinica usa `confirmed_only`

**Alteracao no formulario de clinica (`src/pages/Clinics.tsx`):**
- Substituir o toggle Sim/Nao de "Recebe por faltas?" por 3 opcoes:
  - "Sempre" (a clinica sempre paga por faltas)
  - "Nunca" (nunca paga por faltas)
  - "Somente confirmados" (paga apenas se paciente confirmou e faltou)

**Alteracao no calculo financeiro (`src/pages/Financial.tsx`):**
- Ajustar `calculatePatientLoss` para considerar o novo tipo `confirmed_only`

### 3. Sistema de Pacotes por Clinica

Criar um sistema onde cada clinica pode ter pacotes (ex: "Social", "Premium") com nome, descricao e valor. Ao cadastrar um paciente, poder selecionar qual pacote ele pertence.

**Alteracao no banco de dados (migracao SQL):**
- Criar tabela `clinic_packages`:
  - `id` (uuid, PK)
  - `user_id` (uuid, NOT NULL)
  - `clinic_id` (uuid, NOT NULL)
  - `name` (text, NOT NULL) - ex: "Pacote Social", "Pacote Premium"
  - `description` (text)
  - `price` (numeric, NOT NULL)
  - `is_active` (boolean, default true)
  - `created_at`, `updated_at`
- RLS: `auth.uid() = user_id`
- Adicionar coluna `package_id` (uuid, nullable) na tabela `patients`

**Alteracao nos tipos (`src/types/index.ts`):**
- Adicionar tipo `ClinicPackage`
- Adicionar `packageId?: string` no tipo `Patient`

**Alteracao no contexto (`src/contexts/AppContext.tsx`):**
- Carregar pacotes do banco
- Funcoes `addPackage`, `updatePackage`, `deletePackage`

**Alteracao na UI da clinica (`src/pages/Clinics.tsx` e `src/pages/ClinicDetail.tsx`):**
- Adicionar secao "Pacotes" na clinica, com botao para criar pacotes
- Cada pacote mostra nome, descricao e valor
- Poder editar/excluir pacotes

**Alteracao no cadastro de paciente (`src/pages/ClinicDetail.tsx`):**
- No formulario de novo paciente, adicionar campo Select para escolher o pacote da clinica
- Ao selecionar um pacote, preencher automaticamente o valor do pagamento

**Alteracao no detalhe do paciente (`src/pages/PatientDetail.tsx`):**
- Mostrar o pacote associado ao paciente nas informacoes clinicas

---

### Detalhes Tecnicos

**Migracao SQL:**

```text
-- Novo campo para tipo de pagamento de faltas
ALTER TABLE clinics ADD COLUMN absence_payment_type text DEFAULT 'always';

-- Campo de confirmacao na evolucao
ALTER TABLE evolutions ADD COLUMN confirmed_attendance boolean DEFAULT false;

-- Tabela de pacotes
CREATE TABLE clinic_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE clinic_packages ENABLE ROW LEVEL SECURITY;
-- 4 politicas PERMISSIVE com auth.uid() = user_id

-- Referencia de pacote no paciente
ALTER TABLE patients ADD COLUMN package_id uuid;
```

**Arquivos a modificar:**
| Arquivo | Alteracao |
|---------|-----------|
| `src/types/index.ts` | Adicionar `ClinicPackage`, `absencePaymentType` em Clinic, `packageId` em Patient |
| `src/contexts/AppContext.tsx` | Carregar pacotes, CRUD de pacotes, mapear novos campos |
| `src/pages/PatientDetail.tsx` | Remover assinatura, mostrar pacote, campo confirmacao |
| `src/components/evolutions/EditEvolutionDialog.tsx` | Remover assinatura |
| `src/pages/Clinics.tsx` | 3 opcoes de falta, gerenciamento de pacotes |
| `src/pages/ClinicDetail.tsx` | Selecao de pacote ao cadastrar paciente |
| `src/pages/Financial.tsx` | Ajustar calculo de perdas com `confirmed_only` |

