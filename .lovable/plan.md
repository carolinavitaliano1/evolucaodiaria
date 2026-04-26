
## Objetivo

Garantir que terapeutas convidados vejam **apenas suas próprias evoluções, anexos e documentos** por padrão, mesmo dentro de um paciente compartilhado. Acesso ampliado precisa ser concedido explicitamente no momento do convite (ou na edição de permissões), através do nível **"Acesso Total"** já existente no Módulo Clínico.

## Contexto técnico encontrado

- A permissão `evolutions.own_only` já existe em `useOrgPermissions.ts` e está no `DEFAULT_THERAPIST_PERMISSIONS`, mas **não está sendo aplicada como filtro** no UI.
- `Patients.tsx` já filtra a lista por `useMyAssignedPatientIds()` quando `patients.own_only` está ativo. ✅
- O nível **"Acesso Total"** do Módulo Clínico já remove `evolutions.own_only` e `patients.own_only` corretamente — então admins podem liberar visão completa pelo `PermissionEditor` no convite.
- Pontos onde a filtragem por autor está faltando hoje:
  1. `src/pages/PatientDetail.tsx` → `patientEvolutions` (linha 232) — lista todas as evoluções do paciente.
  2. `src/components/clinics/ClinicEvolutionsTab.tsx` → `dayEvolutions` (linha 66) — lista evoluções do dia de toda a clínica.
  3. `PatientDetail` aba **Documentos** (linha 3005) — `patientAttachments` mostra anexos do paciente sem filtrar autor; "Anexos das Evoluções" também mostra de todos.
  4. `Tarefas` e `Notas` do paciente — também listam de todos os usuários da org.

## Mudanças propostas

### 1. Helper de filtro `evolutions.own_only`
Em `src/hooks/useOrgPermissions.ts`, exportar uma função utilitária `shouldFilterOwnOnly(permissions, key)` para padronizar a checagem (`isOrgMember && !isOwner && hasPermission(permissions, key)`). Isso evita duplicar a lógica.

### 2. `PatientDetail.tsx` — filtrar evoluções por `user_id`
- Quando `evolutions.own_only` estiver ativo (e o usuário não for owner), `patientEvolutions` filtra somente `evo.userId === user.id`.
- Os "feriados automáticos" (gerados a partir de `calendar_blocks`) continuam visíveis para todos (são contexto, não conteúdo clínico).
- Adicionar um aviso sutil no topo da aba Evoluções: *"Você está vendo apenas as evoluções registradas por você."* com botão para o admin entender o porquê.

### 3. `PatientDetail.tsx` — filtrar Documentos por `user_id`
- `patientAttachments` (linha 294): aplicar mesmo filtro quando `evolutions.own_only` estiver ativo (anexos têm `user_id` no schema da tabela `attachments`).
- "Anexos das Evoluções" (linha 3015): só mostrar anexos das evoluções já filtradas.
- O `FileUpload` continua permitindo o terapeuta anexar novos documentos (RLS permite).

### 4. `PatientDetail.tsx` — filtrar Notas e Tarefas
- `patientTasksList` e `clinic_notes` exibidos no paciente: aplicar o mesmo filtro por `user_id` quando `evolutions.own_only` estiver ativo (alinhamento de comportamento).

### 5. `ClinicEvolutionsTab.tsx` — filtrar lista da clínica
- Em `dayEvolutions` (linha 66), forçar `filterUserId = user.id` quando `evolutions.own_only` estiver ativo, e **desabilitar** o seletor "Filtrar por profissional" (mostrar bloqueado com tooltip).

### 6. `ClinicTeam.tsx` — clarear o convite
- No modal "Gerenciar permissões", deixar mais visível qual nível do **Módulo Clínico** está selecionado, com texto destacando: *"Padrão: o terapeuta vê apenas seus próprios pacientes, evoluções e documentos. Selecione 'Acesso Total' para liberar visão de toda a clínica."*
- **Não é necessária migração de banco**: as permissões padrão já existem e o nível "Acesso Total" já está implementado.

### 7. RLS — segurança em nível de banco (opcional, recomendado)
As políticas atuais permitem que qualquer membro da org leia todas as evoluções/anexos da clínica compartilhada. O filtro acima é apenas no UI. Para reforçar de fato no backend, eu poderia atualizar as policies de `evolutions` e `attachments` para também checar:
- `evolutions`: se `evolutions.own_only` estiver nas permissões do usuário, restringir a `user_id = auth.uid()`.
- Isso exige uma função SECURITY DEFINER que lê `organization_members.permissions` do solicitante.

⚠️ **Decisão necessária**: Confirme se quer que eu inclua o passo 7 (RLS reforçado no banco) ou apenas a filtragem na UI (passos 1–6). Sem o passo 7, um terapeuta com conhecimento técnico ainda conseguiria ler dados de colegas via API direta.

## Arquivos a editar
- `src/hooks/useOrgPermissions.ts` (adicionar helper)
- `src/pages/PatientDetail.tsx` (filtros de evoluções, anexos, notas, tarefas)
- `src/components/clinics/ClinicEvolutionsTab.tsx` (forçar filtro por usuário)
- `src/components/clinics/ClinicTeam.tsx` / `PermissionEditor.tsx` (texto explicativo)
- (Opcional) Nova migração SQL para RLS reforçada

## Comportamento final
| Cenário | Antes | Depois |
|---|---|---|
| Terapeuta abre paciente vinculado | Vê todas as evoluções da equipe | Vê só as próprias |
| Terapeuta abre aba Documentos | Vê todos anexos | Vê só os próprios |
| Admin libera "Acesso Total" no convite | (já funcionava) | (continua) Vê tudo |
| Owner | Vê tudo | Vê tudo |
