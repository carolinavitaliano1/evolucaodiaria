

## Plano: Sistema de Fichas e Questionários Reutilizáveis

### Problema Atual
Hoje existe apenas uma "Ficha" (anamnese fixa) com perguntas personalizadas avulsas. O terapeuta não consegue salvar conjuntos de perguntas como templates reutilizáveis, nem enviar múltiplos questionários/testes ao paciente.

### Visão Geral da Solução

Transformar a aba "Ficha" em "Fichas" — um sistema onde o terapeuta cria **templates de questionários** reutilizáveis e os **envia** para pacientes preencherem pelo portal. Inclui também a futura funcionalidade de digitalização de arquivos via IA.

---

### 1. Nova Tabela: `questionnaire_templates`

Armazena templates reutilizáveis criados pelo terapeuta (ex: "Anamnese Infantil", "Escala de Ansiedade", "Teste TDAH").

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | Terapeuta dono |
| name | text | Nome do template |
| description | text | Descrição opcional |
| fields | jsonb | Array de campos (mesmo formato do `intake_custom_questions`) |
| is_active | boolean | Ativo/inativo |
| created_at / updated_at | timestamp | Datas |

### 2. Nova Tabela: `patient_questionnaires`

Representa um questionário enviado a um paciente específico.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | PK |
| template_id | uuid | FK para `questionnaire_templates` |
| patient_id | uuid | Paciente |
| portal_account_id | uuid | Conta do portal |
| therapist_user_id | uuid | Terapeuta |
| title | text | Nome do questionário (copiado do template) |
| fields | jsonb | Campos (snapshot do template no momento do envio) |
| answers | jsonb | Respostas do paciente |
| status | text | `pending` / `submitted` / `reviewed` |
| submitted_at | timestamp | Quando foi preenchido |
| created_at / updated_at | timestamp | Datas |

RLS: terapeuta acessa pelo `therapist_user_id`, paciente acessa via `is_portal_patient(patient_id)`.

---

### 3. Lado do Terapeuta (PortalTab.tsx)

**Seção "Fichas e Questionários"** dentro da aba Portal do paciente:

- **Ficha de Anamnese** (existente) — mantém o comportamento atual como a ficha padrão
- **Templates salvos** — lista de templates do terapeuta com botão "Enviar para este paciente"
- **Criar novo template** — formulário para criar/editar templates de questionários reutilizáveis (nome, descrição, campos dinâmicos com tipos text/textarea/select/yesno/number)
- **Questionários enviados** — lista de questionários já enviados ao paciente com status (Pendente/Preenchido/Revisado) e botão para ver respostas ou baixar PDF

**Novo componente**: `QuestionnaireTemplatesManager.tsx` — gerenciador de templates (CRUD completo, similar ao `IntakeCustomQuestionsManager` mas para conjuntos completos de perguntas).

**Funcionalidade de IA (digitalização)**: Botão "Importar de arquivo" que aceita PDF/imagem, envia para uma Edge Function que usa Lovable AI para extrair as perguntas e gerar automaticamente os campos do template.

---

### 4. Lado do Paciente (Portal)

- Renomear aba de **"Ficha"** para **"Fichas"** no `PortalLayout.tsx`, `PortalHome.tsx`
- **Nova página** `PortalQuestionnaires.tsx` (ou expandir `PortalIntakeForm.tsx`):
  - Lista todos os questionários pendentes e já preenchidos
  - A ficha de anamnese aparece como item fixo no topo
  - Cada questionário pendente tem botão "Preencher" que abre o formulário dinâmico
  - Questionários preenchidos mostram "Enviado em DD/MM/YYYY"

---

### 5. Edge Function: `digitize-questionnaire`

- Recebe arquivo (PDF/imagem) via upload
- Usa Lovable AI (gemini-2.5-pro, bom com imagem+texto) para extrair perguntas
- Retorna array de campos estruturados (question, field_type, options)
- O terapeuta revisa e ajusta antes de salvar como template

---

### 6. Alterações em Arquivos Existentes

| Arquivo | Alteração |
|---------|-----------|
| `PortalLayout.tsx` | Renomear "Ficha" → "Fichas" |
| `PortalHome.tsx` | Renomear "Minha Ficha" → "Minhas Fichas" |
| `App.tsx` | Adicionar rota `/portal/fichas` (manter `/portal/ficha` como redirect) |
| `PortalIntakeForm.tsx` | Expandir para listar anamnese + questionários enviados |
| `PortalTab.tsx` | Adicionar seção de gerenciamento de templates e envio de questionários |

### 7. Resumo das Migrações SQL

1. Criar tabela `questionnaire_templates` com RLS (dono = user_id)
2. Criar tabela `patient_questionnaires` com RLS (terapeuta + portal patient)
3. Políticas de acesso para leitura pelo paciente via portal

### Detalhes Técnicos

- Os campos dos templates usam o mesmo formato JSON dos `intake_custom_questions`: `{ id, question/label, field_type, options, required }`
- Ao enviar um questionário, os campos são copiados (snapshot) para `patient_questionnaires.fields`, garantindo que edições futuras no template não afetem questionários já enviados
- A digitalização via IA usa tool calling para extrair output estruturado (array de perguntas com tipos)
- PDF de respostas usa jsPDF no cliente, padrão já existente no projeto

