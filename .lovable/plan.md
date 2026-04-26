## Visão Dedicada do Terapeuta Convidado

Atualmente o terapeuta convidado vê o mesmo sidebar de um dono de clínica (com itens "trancados" 🔒). Vou criar uma experiência **enxuta, focada e personalizada** para ele.

---

### 1. Novo Sidebar Simplificado para Terapeutas

Quando o usuário for `isOrgMember && !isOwner && role === 'professional'`, o sidebar exibirá APENAS:

- **Meu Perfil**
- 📊 **Dashboard** — visão pessoal (seus pacientes, suas evoluções pendentes, próximos atendimentos)
- 📅 **Agenda** — somente seus atendimentos
- 👥 **Pacientes** — somente os atribuídos a ele (já filtrado por `patients.own_only`)
- ✅ **Tarefas** — suas tarefas
- 💰 **Minhas Comissões** *(NOVO — substitui "Financeiro")* — ganhos pessoais, sessões realizadas, repasses
- 📢 **Mural** (se tiver permissão)
- 🎧 **Suporte**

**Itens removidos** dessa visão: Clínicas, Financeiro global, Relatórios globais, Relatórios IA, Doc IA, Equipe, Planos, Instalar App.
(Estes ficam reservados para owners/admins.)

**Implementação:** em `AppSidebar.tsx`, criar uma nova lista `therapistNavItems` e usar quando o usuário for terapeuta não-owner. O item "Financeiro" será trocado por "Minhas Comissões" apontando para uma nova rota `/minhas-comissoes`.

---

### 2. Nova Página: `/minhas-comissoes` (Financeiro do Terapeuta)

Página dedicada mostrando os **ganhos do próprio terapeuta** com base no modelo de remuneração configurado pelo admin (`organization_members.payment_*`).

**Conteúdo:**
- **Cards de resumo do mês:** Total a Receber, Sessões Realizadas, Faltas, Pacientes Atendidos.
- **Navegador de mês** (igual aos outros relatórios financeiros).
- **Detalhamento por paciente:** lista de cada paciente com nº de sessões, valor unitário, subtotal.
- **Histórico mensal (últimos 6 meses)** em mini-gráfico.
- **Botão "Exportar PDF"** com extrato pessoal.

**Cálculo:** reutilizar `calculateMemberRemuneration` de `src/utils/financialHelpers.ts`, filtrando evoluções por `user_id = user.id` no mês selecionado.

**Acesso:** requer permissão nova `commissions.view` (auto-incluída em `DEFAULT_THERAPIST_PERMISSIONS`).

---

### 3. Dashboard Personalizado do Terapeuta

Quando `isOrgMember && !isOwner`, o `Dashboard.tsx` exibirá uma versão simplificada:
- **Removidos:** PendingEnrollmentsCard, ClinicAlertsCard global, MuralNoticesBell de admin.
- **Mantidos/Destacados:** Saudação, MiniCalendar, Resumo do Dia (atendimentos próprios), TodayAppointments (apenas seus), TaskList (suas tarefas), MissingEvolutionsAlert (suas evoluções atrasadas), BirthdayCard.
- **Adicionado:** Card "Resumo de Comissões do Mês" (total a receber + nº de sessões) com link para `/minhas-comissoes`.

---

### 4. Anexar Documentos a Pacientes (visão Terapeuta)

Hoje o terapeuta consegue criar evoluções, mas não tem um espaço para **anexar documentos avulsos** (PDFs, exames, declarações externas) que apareçam direto na aba "Documentos" do paciente.

**Implementação:**
- Na aba "Anexos" / "Documentos" do `PatientDetail.tsx` (que já existe via `loadAttachmentsForPatient`), adicionar um botão **"+ Anexar Documento"** visível para terapeutas com acesso àquele paciente.
- Permitir upload via `FileUpload` (bucket `patient-attachments`), categorizando como `parent_type = 'patient_doc'` e `uploaded_by_user_id = user.id`.
- Os anexos enviados pelo terapeuta aparecerão imediatamente na aba **Documentos** do paciente, com tag mostrando o nome de quem anexou e data.
- Compatível com a permissão `patients.own_only` (RLS já restringe a pacientes atribuídos).

---

### 5. Mobile Nav

Atualizar `MobileNav.tsx` espelhando o mesmo conjunto reduzido para terapeutas (Dashboard, Agenda, Pacientes, Comissões, Tarefas).

---

### 6. Migration / Permissões

- Adicionar a permissão `commissions.view` em `ALL_PERMISSIONS` (`useOrgPermissions.ts`).
- Incluir `commissions.view` em `DEFAULT_THERAPIST_PERMISSIONS`.
- Migration retroativa: dar `commissions.view` a todos os membros `professional` ativos existentes.

---

### Arquivos a editar/criar

**Editar:**
- `src/components/layout/AppSidebar.tsx` — bifurcar nav por papel
- `src/components/layout/MobileNav.tsx` — espelhar
- `src/pages/Dashboard.tsx` — variante terapeuta
- `src/pages/PatientDetail.tsx` — botão de anexar documento
- `src/hooks/useOrgPermissions.ts` — nova permissão
- `src/App.tsx` — registrar rota `/minhas-comissoes`

**Criar:**
- `src/pages/MyCommissions.tsx` — nova página financeira pessoal
- Migration SQL para `commissions.view`

---

### Resultado esperado

Após login, o terapeuta convidado verá um app **limpo, com 7 itens no menu**, focado no que importa pra ele: agenda, pacientes, evoluções, tarefas e seus ganhos — exatamente como o exemplo da imagem (Agenda, Pacientes, Minhas Comissões).