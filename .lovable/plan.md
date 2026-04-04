

# Grupos Terapêuticos — Implementação

## Resumo
Criar a funcionalidade completa de Grupos Terapêuticos como nova aba na clínica/consultório, com tabelas no banco, componente de gestão e formulário de cadastro/edição.

## 1. Migração SQL
Criar duas tabelas:

- **`therapeutic_groups`**: `id`, `user_id`, `clinic_id`, `name` (obrigatório), campos opcionais de texto (description, therapeutic_focus, objectives, support_reason, shared_goals, communication_patterns, conflict_areas, meeting_frequency, meeting_format, facilitation_style, waitlist_policy, entry_criteria, exclusion_criteria, confidentiality_agreement, group_rules, materials, support_resources, assessment_method, next_topics, facilitation_notes, supervision_notes, general_notes, follow_up_plan, session_link), `duration_minutes` (int), `max_participants` (int), `open_to_new` (boolean default false), `default_price` (numeric), `is_archived` (boolean default false), timestamps.

- **`therapeutic_group_members`**: `id`, `group_id` (FK → therapeutic_groups ON DELETE CASCADE), `patient_id` (uuid), `joined_at` (timestamptz default now()), `status` ('active'|'inactive' default 'active').

RLS: owner (`user_id = auth.uid()`) + org member access via `is_clinic_org_member`.

## 2. Componente `TherapeuticGroupsTab.tsx`
Novo arquivo `src/components/clinics/TherapeuticGroupsTab.tsx`:

- **Props**: `clinicId`, `patients` (lista de pacientes da clínica)
- **Lista**: cards com nome do grupo, quantidade de participantes, badge ativo/arquivado
- **Dialog de cadastro/edição**: formulário com Accordion em seções:
  - Sobre o grupo (descrição, foco, objetivos, motivo, metas, padrões, conflitos)
  - Estrutura dos encontros (frequência, duração, formato, estilo, aberto, máx participantes, lista espera)
  - Plano de acompanhamento
  - Critérios e materiais (entrada, exclusão, confidencialidade, regras, materiais, recursos)
  - Acompanhamento clínico (avaliação, próximos tópicos, notas)
  - Configurações de sessão (link externo, preço)
- **Seletor de participantes**: multi-select dos pacientes da clínica com chips removíveis
- **Ações**: criar, editar, arquivar grupo

## 3. Integração em `ClinicDetail.tsx`
- Importar `TherapeuticGroupsTab`
- Adicionar tab `{ value: 'groups', icon: <UsersRound>, label: 'Grupos', color: 'text-indigo-500' }` no array de tabs (após "Serviços")
- Adicionar `<TabsContent value="groups">` renderizando o componente

## Arquivos afetados
| Arquivo | Ação |
|---------|------|
| Migração SQL | Criar tabelas + RLS |
| `src/components/clinics/TherapeuticGroupsTab.tsx` | Criar |
| `src/pages/ClinicDetail.tsx` | Editar — nova aba |

