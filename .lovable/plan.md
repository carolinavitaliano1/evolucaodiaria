

## Plano: Pré-preenchimento de dados e sincronização entre cadastro, fichas, financeiro e contrato

### Problema
1. Quando o paciente/responsável abre a ficha (intake form) pela primeira vez no portal, todos os campos estão vazios — mesmo que já existam dados no cadastro (`patients` table)
2. A `payment_due_day` preenchida na ficha não é refletida no financeiro do portal nem salva no cadastro do paciente
3. A `contract_start_date` não é atualizada automaticamente quando o contrato é assinado pelo portal

### Mudanças

#### 1. Pré-preencher ficha com dados do cadastro (`PortalIntakeForm.tsx`)

No `useEffect` de carregamento, quando **não existe** registro em `patient_intake_forms`, buscar dados da tabela `patients` e preencher os campos correspondentes:

| Campo da Ficha | Campo do Patients |
|---|---|
| `full_name` | `name` |
| `cpf` | `cpf` |
| `birthdate` | `birthdate` |
| `phone` | `phone` |
| `whatsapp` | `whatsapp` |
| `email` | `email` |
| `responsible_name` | `responsible_name` |
| `responsible_cpf` | `responsible_cpf` |
| `responsible_phone` | `responsible_whatsapp` |
| `financial_responsible_name` | `financial_responsible_name` |
| `financial_responsible_cpf` | `financial_responsible_cpf` |
| `observations` | `observations` |
| `health_info` | `diagnosis` |
| `payment_due_day` | `payment_due_day` |

Buscar `patients` com `select(...)` usando os campos necessários quando `formData` é `null`.

#### 2. Sincronizar `payment_due_day` da ficha para o cadastro (`PortalIntakeForm.tsx`)

No `handleSave`, após salvar a ficha com sucesso, se `payment_due_day` foi preenchido, atualizar o campo `payment_due_day` na tabela `patients`:

```text
supabase.from('patients').update({ payment_due_day }).eq('id', patientId)
```

Isso faz com que o portal financeiro (`PortalFinancial.tsx`) já mostre a data correta, pois ele lê de `patient.payment_due_day`.

#### 3. Atualizar `contract_start_date` ao assinar contrato (`PortalContract.tsx`)

No `handleSign`, após a assinatura bem-sucedida, atualizar `patients.contract_start_date` com a data atual:

```text
supabase.from('patients').update({ contract_start_date: new Date().toISOString().split('T')[0] }).eq('id', patientId)
```

### Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `src/pages/portal/PortalIntakeForm.tsx` | Editar — pré-preencher com dados do `patients` + sincronizar `payment_due_day` |
| `src/pages/portal/PortalContract.tsx` | Editar — salvar `contract_start_date` ao assinar |

