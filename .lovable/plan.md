

## Análise da Amplimed e melhorias para o módulo de Equipe

### O que vi no site da Amplimed
A página vende um sistema de gestão de clínicas com 5 planos (Lite → Enterprise). As funcionalidades destacadas para clínicas multiprofissionais que se conectam à ideia de "gestão de equipe" são:

1. **Controle de repasse de profissionais** (plano Plus) — split financeiro automatizado.
2. **Tarefas automatizadas e processos integrados** ("equipe sobrecarregada").
3. **Pesquisa de satisfação** e indicadores.
4. **Agenda por paciente** e portal de agendamento 24/7.
5. **Painel de senha** (chamada de pacientes na recepção).
6. **Acompanhamento terapêutico** com histórico organizado de intervenções, plano educativo individualizado (PEI), repositório de mídias, motivos de entrada/saída/alta.
7. **Confirmações automáticas por WhatsApp + lista de espera** (já temos).
8. **Implantação assistida** (cadastramento, treinamento, migração).

### O que **já existe** no nosso módulo de Equipe (não duplicar)
Comparando com `Team.tsx`, `ClinicTeam.tsx`, `TeamAttendanceGrid.tsx`, `TeamFinancialDashboard.tsx`, `ComplianceDashboard.tsx`:
- Convite de membros por e-mail com cargo, permissões granulares e atribuição de pacientes.
- 4 modelos de remuneração (sessão / mensal / diário / variado) — equivalente ao "controle de repasse".
- Grade de presença semanal com justificativas e anexos.
- Dashboard financeiro por membro com ranking, gráficos de 6 meses e exportação PDF.
- Compliance: alerta de evoluções atrasadas (>24h) por profissional.
- Lista de espera pública por clínica.
- WhatsApp com templates e variáveis.

### O que **vale trazer** da Amplimed (gaps reais)

Selecionei **3 melhorias práticas** que se encaixam no nosso módulo de Equipe sem inflar o produto:

#### 1. Tarefas atribuídas a membros da equipe (workflow interno)
Hoje `tasks` existe só por usuário. A Amplimed enfatiza "tarefas automatizadas para reduzir retrabalho". Proposta:
- Adicionar `assigned_to_user_id` e `clinic_id` em `tasks`.
- Nova aba **"Tarefas da Equipe"** dentro de Team (ao lado de Equipe / Compliance / Atividade / Financeiro).
- Owner/admin pode criar tarefa e atribuir a um membro; membro vê suas tarefas no Dashboard.
- Filtros: pendentes, atribuídas a mim, atribuídas por mim, vencidas.

#### 2. Painel de Indicadores da Equipe (KPIs)
A Amplimed vende "indicadores" no plano Pro. Hoje temos números espalhados (financeiro, compliance, presença), mas sem visão consolidada. Proposta:
- Nova aba **"Indicadores"** em Team com cards de:
  - Taxa de presença da equipe (mês).
  - Taxa de evoluções no prazo (vs. atrasadas).
  - Pacientes ativos por profissional.
  - Tempo médio entre sessão e registro de evolução.
  - Top 3 profissionais por sessões realizadas.
- Tudo derivado de tabelas existentes (`evolutions`, `team_attendance`, `patients`) — sem schema novo.

#### 3. Motivos estruturados de saída (PEI / acompanhamento terapêutico)
A Amplimed cita "cadastro de motivos (entrada, saída e alta)". Hoje temos `departure_reason` como texto livre. Proposta:
- Transformar em select estruturado: **Alta clínica / Transferência / Desistência / Mudança de cidade / Financeiro / Outro**.
- Adicionar relatório agregado em **"Indicadores"**: % de cada motivo de saída no período → ajuda gestor a entender churn da clínica.
- Mantém compatibilidade com texto livre quando "Outro" for selecionado.

### O que **não** trazer (e por quê)
- **Faturamento TISS / NFS-e**: nosso público (psicólogos, terapeutas, fonos) trabalha majoritariamente fora de convênios.
- **Painel de senha / totem**: não se aplica a consultórios de psicoterapia.
- **Teleconsulta nativa**: já temos `session_link` para consulta virtual via link externo.
- **Amélia Copilot (transcrição)**: já temos suite IA própria (improve-evolution, generate-evolution, generate-feedback) que cobre o caso.

### Arquivos afetados (visão técnica)

**Migração (1 arquivo SQL):**
- `tasks`: adicionar `assigned_to_user_id uuid`, `clinic_id uuid`, `due_date date`, `priority text`.
- Atualizar RLS para permitir membros da org verem tarefas atribuídas a eles.

**Frontend (~5 arquivos):**
- `src/pages/Team.tsx` — adicionar abas "Tarefas" e "Indicadores".
- `src/components/team/TeamTasksTab.tsx` (novo) — lista, criação, filtros.
- `src/components/team/TeamIndicatorsTab.tsx` (novo) — cards KPI + breakdown de motivos de saída.
- `src/components/dashboard/TaskList.tsx` — incluir tarefas atribuídas pela equipe.
- `src/components/patients/DeparturePatientDialog.tsx` — converter motivo em select + texto livre condicional.

**Tipos:**
- `src/types/index.ts` — `Task` ganha `assignedToUserId`, `clinicId`, `dueDate`, `priority`.

### Resultado esperado
- Gestor de clínica passa a delegar tarefas a profissionais dentro do app (sem WhatsApp paralelo).
- Owner/admin vê em uma aba os principais indicadores operacionais e clínicos da equipe.
- Saída de paciente vira dado estruturado, permitindo análise de churn e melhoria de processos.

