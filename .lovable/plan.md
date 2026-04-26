
## Problema identificado

A página **`src/pages/MyCommissions.tsx`** (acessada pelo terapeuta no dashboard via "Minhas Comissões") ainda usa a função legada `calculateMemberRemuneration`, que lê apenas os campos `remuneration_type` / `remuneration_value` direto da tabela `organization_members`.

Resultado: quando o gestor cadastra/edita os **Planos de Remuneração** (tabela `member_remuneration_plans`) e atribui planos específicos por paciente (campo `remuneration_plan_id` em `therapist_patient_assignments`), nada disso aparece para o terapeuta — ele continua vendo o valor antigo (ou zero, se nunca houve um valor legado).

As telas do gestor (`TeamFinancialDashboard`, `TeamFinancialReport`) já foram migradas; falta apenas espelhar a mesma lógica do lado do colaborador.

## Correção proposta

### 1. `src/pages/MyCommissions.tsx` — usar `calculateMemberRemunerationByPlans`

**a) Carregar os planos do membro e o mapa de atribuições por paciente** logo após carregar o `organization_members` do usuário:
- `SELECT * FROM member_remuneration_plans WHERE member_id = m.id ORDER BY is_default DESC, name`
- `SELECT patient_id, remuneration_plan_id FROM therapist_patient_assignments WHERE member_id = m.id` → montar `assignmentPlanMap: Record<patientId, planId | null>`

**b) Substituir o cálculo do mês corrente** (`totalCommission`) por `calculateMemberRemunerationByPlans({ plans, assignmentPlanMap, evolutions, legacyType, legacyValue })`, mantendo o fallback legado quando o membro ainda não tem planos.

**c) Substituir o cálculo do histórico de 6 meses** pela mesma função (atualmente roda `calculateMemberRemuneration` em loop). Reutilizar `plans` e `assignmentPlanMap` já carregados.

**d) Exibir o breakdown por plano** (já produzido pela função) abaixo do card "Total a receber":
- Lista compacta com nome do plano, tipo (Por sessão / Mensal / Diário / Pacote), valor unitário, contagem (sessões ou pacientes) e subtotal.
- Quando `usedLegacy = true`, esconder o breakdown e manter o comportamento atual.

**e) Atualizar o "Modelo de remuneração"** no card do topo:
- Se houver múltiplos planos: mostrar a quantidade ("3 planos cadastrados") e listar os nomes dos planos como badges, ao invés do badge único "R$ X / sessão".
- Se houver apenas o plano padrão (ou fallback legado): manter o visual atual.

**f) Atualizar o "Detalhamento por paciente"**:
- Adicionar coluna "Plano" mostrando o nome do plano que se aplica àquele paciente (resolvido via `assignmentPlanMap[patientId] || planoDefault`).
- Recalcular a coluna "Subtotal" usando o valor do plano específico de cada paciente (não mais um único `valuePerSession` global). Para planos `fixo_mensal`/`fixo_dia`/`pacote`, mostrar `—` no subtotal por linha (o subtotal real desses tipos aparece no breakdown geral, não por paciente).

### 2. Realtime / atualização imediata (opcional, mas recomendado)

Adicionar uma assinatura simples para que, se o gestor alterar planos enquanto o terapeuta está com a tela aberta, o valor recalcule:
- Subscription em `member_remuneration_plans` filtrando por `member_id`
- Subscription em `therapist_patient_assignments` filtrando por `member_id`

Cada evento dispara um reload dos planos + assignments + recálculo. Usar nomes de canais únicos (`my-commissions-plans-${user.id}`) conforme a convenção do projeto.

### 3. Verificação

- Rodar `tsc` para garantir que os tipos do `MemberRemunerationByPlansContext` estão corretos.
- Confirmar visualmente que: (i) ao cadastrar um plano novo no gestor, o terapeuta vê refletido; (ii) ao trocar o plano de um paciente, o subtotal daquele paciente muda; (iii) o total bate com o que o gestor vê em `TeamFinancialDashboard` para o mesmo membro/mês.

## Arquivos a editar

- `src/pages/MyCommissions.tsx` (única alteração de código)

Nenhuma migração de banco é necessária — a infraestrutura (`member_remuneration_plans`, `remuneration_plan_id` em assignments, RLS "Members can view own remuneration plans") já existe e permite que o próprio terapeuta leia seus planos.
