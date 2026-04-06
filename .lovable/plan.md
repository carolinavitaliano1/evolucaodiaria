

## Plano: Configuração de Pagamento por Membro no Grupo Terapêutico

### Problema
Atualmente, quando uma evolução de grupo é salva no prontuário individual, o sistema contabiliza o valor financeiro para **todos** os membros. Não há como diferenciar quem paga e quem não paga pelo grupo. O terapeuta precisa controlar isso por membro.

### Solução

Adicionar campos `is_paying` (boolean) e `member_payment_value` (numeric) na tabela `therapeutic_group_members` para controlar individualmente quem paga e quanto paga no grupo.

#### 1. Migração de banco de dados

```sql
ALTER TABLE public.therapeutic_group_members
  ADD COLUMN is_paying boolean NOT NULL DEFAULT true,
  ADD COLUMN member_payment_value numeric DEFAULT NULL;
```

#### 2. Configuração de membros no grupo (TherapeuticGroupsTab.tsx + GroupDetail.tsx)

- No formulário de criação/edição do grupo, ao lado de cada paciente selecionado, adicionar:
  - Toggle "Pagante" (is_paying)
  - Campo de valor individual (member_payment_value) — visível apenas quando pagante
- Ao salvar o grupo, persistir `is_paying` e `member_payment_value` na tabela `therapeutic_group_members`
- Na aba "Informações" do GroupDetail, exibir a lista de membros com status pagante/não pagante e valor

#### 3. Lógica financeira (Financial.tsx + ClinicFinancial.tsx)

Alterar a lógica de cálculo de receita para evoluções de grupo:

```
Se evolução tem group_id:
  1. Buscar o registro do membro em therapeutic_group_members
  2. Se is_paying = false → valor = 0 (não contabiliza)
  3. Se is_paying = true → usar member_payment_value (se definido) OU default_price do grupo
Se não tem group_id:
  → lógica individual atual (sem mudança)
```

- Carregar dados de `therapeutic_group_members` (is_paying, member_payment_value) junto com group_prices
- Criar um mapa `memberPaymentConfig[groupId][patientId] = { isPaying, value }`

#### 4. Arquivos a editar

1. **Migração SQL** — adicionar `is_paying` e `member_payment_value` à `therapeutic_group_members`
2. **src/components/clinics/TherapeuticGroupsTab.tsx** — UI de toggle pagante + valor por membro no formulário do grupo; persistir os novos campos ao salvar
3. **src/pages/GroupDetail.tsx** — exibir configuração de pagamento dos membros na aba Informações
4. **src/pages/Financial.tsx** — carregar member payment config e usar na lógica de `calculatePatientRevenue`
5. **src/components/clinics/ClinicFinancial.tsx** — mesma lógica no `calcPatientRevenue`

### Fluxo do usuário

1. Terapeuta cria/edita grupo → seleciona membros → marca Benjamin como "pagante" (R$50/sessão) e Lica como "não pagante"
2. Sessão de grupo → evolução salva para ambos no prontuário individual
3. No financeiro → Benjamin contabiliza R$50 por sessão de grupo; Lica aparece com 0 sessões faturáveis de grupo

