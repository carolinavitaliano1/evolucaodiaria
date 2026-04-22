

# Plano: Cadastro de Terapeutas (link público) + Visão de Planos no Cadastro do Paciente

Vou implementar **duas frentes** que conversam com o que você já tem.

---

## Frente 1 — Link público de auto-cadastro de terapeutas

Como o `/lista-espera/:clinicId` funciona pra pacientes, vou criar o equivalente para terapeutas se candidatarem à equipe.

### Como vai funcionar
1. Na aba **Equipe** da clínica, novo card **"Link de candidatura"** com:
   - URL pública: `https://evolucaodiaria.app.br/candidatura-equipe/:organizationId`
   - Botões: **Copiar link**, **Compartilhar via WhatsApp**, **QR Code**
   - Switch para ativar/desativar o link
2. Página pública `/candidatura-equipe/:organizationId` — sem login, mostra:
   - Nome da organização/clínica
   - Formulário: Nome completo, E-mail, WhatsApp, Especialidade (CBO), Registro profissional, Mensagem opcional
3. Após envio, vira uma **candidatura pendente** que aparece em nova seção **"Candidaturas pendentes"** dentro do dashboard de Equipe.
4. Você (admin/owner) tem 2 botões em cada candidatura:
   - **Aprovar** → dispara o fluxo atual de `invite-member` (cria conta + envia credenciais)
   - **Recusar** → marca como rejeitada
5. Notificação interna via `internal_notifications` quando chega candidatura nova.

### Tabela nova
```
team_applications
- id, organization_id, name, email, whatsapp, specialty,
  professional_id, message, status (pending/approved/rejected),
  created_at, reviewed_at, reviewed_by_user_id
```
RLS: anônimo só pode INSERT; SELECT/UPDATE só para owner/admin da organização.

### Toggle do link
Coluna `applications_link_enabled boolean` na tabela `organizations` (default `true`).

---

## Frente 2 — "Planos de Tratamento" e "Pacotes" no cadastro do paciente

Aqui você misturou duas coisas que o sistema **já tem separadas**, então vou clarificar e melhorar:

### O que já existe hoje
- **Planos de tratamento clínicos** (`session_plans`) → na aba **Processo Terapêutico** do paciente. Já permite título, objetivos, atividades, evolução, histórico.
- **Pacotes da clínica** (`clinic_packages`) → cadastrados em **Clínicas → Pacotes**. Tipos: Mensal, Por Sessão, Personalizado. Cada paciente tem `package_id` apontando para um pacote.
- **Remuneração do paciente** (`payment_value`/`payment_type`) → editado no `EditPatientDialog`.

### O que vou melhorar

#### A) Aba "Plano & Financeiro" do paciente (nova consolidação visual)
Hoje a remuneração está escondida no botão "Editar paciente". Vou criar uma seção destacada **na aba Financeiro do paciente** com 3 blocos lado a lado:

| Bloco | Conteúdo |
|---|---|
| **Plano de pagamento** | Tipo (Sessão/Fixo Mensal), Valor, Dia de vencimento — editável inline |
| **Pacote contratado** | Dropdown dos `clinic_packages` ativos da clínica + "Sem pacote". Mostra preço, sessões incluídas, progresso do mês |
| **Plano de tratamento ativo** | Link para o `session_plan` ativo (ou "Criar plano" se não houver) — abre a aba Processo Terapêutico |

Permissão: respeita `permissions.patients.financial` (admin/responsável financeiro).

#### B) Tela "Pacotes" da clínica — visão por pacote
Em **Clínicas → Pacotes**, cada card de pacote ganha:
- Contador "**X pacientes vinculados**"
- Botão **"Ver pacientes"** → modal com lista (nome, status, data de início, ações: trocar pacote / remover)
- Botão **"Vincular pacientes"** → multi-select de pacientes da clínica sem pacote ou com outro pacote

Isso responde diretamente ao seu "cadastro dos planos que atende e quais pacientes estão cadastrados em cada plano".

#### C) Filtro por pacote na lista de pacientes
Em **Pacientes**, novo filtro "Pacote" para listar quem está em cada plano.

---

## Arquivos a criar/editar

### Criar
- `supabase/migrations/...` — nova tabela `team_applications` + coluna `applications_link_enabled`
- `src/pages/TeamApplicationPublic.tsx` — formulário público
- `src/components/clinics/TeamApplicationsPanel.tsx` — painel de candidaturas pendentes
- `src/components/clinics/TeamPublicLinkCard.tsx` — card de gerar/copiar link
- `src/components/patients/PatientPlanCard.tsx` — card consolidado plano/pacote/tratamento
- `src/components/clinics/PackagePatientsModal.tsx` — modal "ver pacientes do pacote"

### Editar
- `src/App.tsx` — rota `/candidatura-equipe/:organizationId`
- `src/components/clinics/ClinicTeam.tsx` — incluir `TeamPublicLinkCard` + `TeamApplicationsPanel`
- `src/pages/PatientDetail.tsx` (aba Financeiro) — incluir `PatientPlanCard`
- `src/pages/Clinics.tsx` (aba Pacotes / `ClinicPackages`) — contador + modal de pacientes
- `src/pages/Patients.tsx` — filtro por pacote
- `supabase/functions/invite-member/index.ts` — aceitar `application_id` opcional pra marcar candidatura como aprovada

---

## RLS resumida da nova tabela
- `INSERT` permitido para `anon` (formulário público)
- `SELECT/UPDATE/DELETE` só para `is_org_owner(organization_id, auth.uid())` ou admin

---

## Pergunta antes de começar
**Auto-aprovação:** quando alguém se candidata pelo link público, você quer:
- (a) sempre revisar manualmente antes do convite ir, **ou**
- (b) já enviar o convite automaticamente e só te notificar?

Minha recomendação: **(a) revisar manualmente** — evita spam e candidatos não-qualificados criando conta no app.

