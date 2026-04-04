

# Página de Detalhe do Grupo Terapêutico

## Resumo
Criar uma página dedicada `/groups/:id` (similar a `/patients/:id`) para cada grupo terapêutico, com visualização completa das informações do grupo e todas as abas funcionais que existem no paciente individual (Evoluções, Sessão, Financeiro, Portal, Mural, Frequência, Documentos, Tarefas, Notas).

## O que muda para o usuário
- Ao clicar em um grupo na aba "Grupos" da clínica, abre a página de detalhe do grupo
- Cabeçalho com nome do grupo, participantes (chips clicáveis), badge ativo/arquivado, botão editar
- Seção "Informações do grupo" com todas as informações organizadas em cards (Visão geral, Estrutura, Critérios, Acompanhamento) — exibindo "—" quando vazio
- Abas idênticas ao paciente individual: Evoluções, Sessão, Rel. Mensal, Financeiro, Documentos, Tarefas, Notas, Portal, Mural, Frequência
- Evoluções/sessões do grupo mostram evoluções vinculadas a todos os participantes (filtradas por grupo)

## Arquivos a criar/editar

### 1. Migração SQL
- Adicionar coluna `group_id uuid` (nullable, FK → therapeutic_groups) nas tabelas `evolutions`, `tasks`, `feed_posts` para vincular registros ao grupo
- Isto permite que evoluções, tarefas e posts do mural sejam criados "para o grupo"

### 2. `src/pages/GroupDetail.tsx` (novo — ~800 linhas)
Página completa inspirada em `PatientDetail.tsx`:
- **Header**: nome do grupo, lista de participantes com avatares/chips (link para cada `/patients/:id`), botões de ação (editar, WhatsApp grupo, arquivar)
- **Info Section**: cards read-only com todos os campos do grupo organizados em 4 blocos (Visão geral, Estrutura, Critérios e combinados, Acompanhamento) — valor "—" quando null
- **Tabs** (mesma estrutura visual do PatientDetail):
  - `evolutions` — lista evoluções dos participantes (filtro por group_id ou por patient_ids do grupo)
  - `session` — reutiliza `TherapeuticSessionTab` adaptado para grupo
  - `reports` — relatório mensal consolidado
  - `financial` — financeiro por participante
  - `documents` — documentos do grupo
  - `tasks` — tarefas vinculadas ao grupo
  - `notes` — notas do grupo (reutiliza padrão de notas)
  - `portal` — portal consolidado dos participantes
  - `mural` — feed/mural do grupo
  - `attendance` — frequência consolidada

### 3. `src/App.tsx`
- Importar `GroupDetail`
- Adicionar rota `/groups/:id` no bloco protegido (ao lado de `/patients/:id`)

### 4. `src/components/clinics/TherapeuticGroupsTab.tsx`
- Tornar o card do grupo clicável → `navigate(/groups/${g.id})`

### 5. Componentes auxiliares reutilizados
- `TherapeuticSessionTab` — recebe prop opcional `groupId` + array de `patientIds` para sessão em grupo
- `PatientFeed` — recebe `groupId` opcional
- `PortalTab` — iteração sobre participantes do grupo

## Escopo da primeira entrega
Dado o tamanho, a implementação será focada em:
1. Página com header + informações completas do grupo (todos os campos)
2. Todas as abas com funcionalidade básica (evoluções agregadas, financeiro, portal, mural, etc.)
3. Navegação da listagem de grupos para a página de detalhe
4. Migração para `group_id` nas tabelas necessárias

