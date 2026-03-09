
## Contexto e Diagnóstico

O sistema já possui:
- `openWhatsApp()` que abre `wa.me/{número}?text={mensagem}` no navegador
- Sistema de templates de mensagens (`message_templates`) com variáveis como `{{nome_paciente}}`, `{{data_consulta}}`, `{{horario}}`, `{{valor_sessao}}`
- `WhatsAppMessageModal` para envio manual
- Dados de pacientes com `whatsapp`, `phone`, `responsible_whatsapp`
- Dados de pagamento em `patient_payment_records` e `clinic_payment_records`

**Limitação técnica importante:** WhatsApp não permite disparo automático real via API sem a API oficial paga (WhatsApp Business API). O que podemos fazer — e é o padrão adotado no app — é **pré-preencher e abrir o WhatsApp** em 1 clique. Não há envio automático verdadeiro sem aprovação do usuário (o WhatsApp bloqueia isso).

O plano consiste em adicionar **botões de ação rápida de WhatsApp** nos pontos certos da UI para tornar o envio de confirmação e lembrete de pagamento extremamente fácil (1 clique), com a mensagem já preenchida.

---

## O que será construído

### 1. Botão "Confirmar Sessão via WhatsApp" na Agenda do Consultório

**`src/components/clinics/ClinicAgenda.tsx`**

Na listagem de pacientes do dia, adicionar um botão verde de WhatsApp ao lado de cada paciente que ainda não tem evolução registrada. Ao clicar, abre o WhatsApp com mensagem de confirmação pré-preenchida usando:
- nome do paciente
- horário da sessão
- data de hoje
- nome do terapeuta (carregado via hook)

### 2. Botão "Confirmar Sessão via WhatsApp" na aba "Hoje" da ClinicDetail

**`src/pages/ClinicDetail.tsx`**

Na lista `todaySchedule`, adicionar o mesmo botão de WhatsApp ao lado de cada paciente agendado.

### 3. Botão "Lembrete de Pagamento via WhatsApp" na aba Financeiro

**`src/components/clinics/ClinicFinancial.tsx`**

Na listagem de pacientes com pagamento pendente (`paid = false`), adicionar um botão de WhatsApp que abre mensagem de cobrança pré-preenchida com:
- nome do paciente
- valor em aberto
- mês de referência
- nome do terapeuta

### 4. Botões de Confirmação no Dashboard

**`src/components/dashboard/TodayAppointments.tsx`**

Adicionar um botão WhatsApp por paciente na lista de hoje (mesma lógica).

---

## Implementação Técnica

### Componente utilitário reutilizável
Criar `src/components/whatsapp/QuickWhatsAppButton.tsx` — um botão ícone verde que recebe `phone`, `message` e dispara `openWhatsApp()`. Simples e reutilizável.

### Hook para perfil do terapeuta
Todos os componentes acima precisam do nome do terapeuta. Usarei `useAuth()` combinado com uma query ao `profiles` já existente nesses componentes.

### Mensagens pré-definidas inteligentes
Cada botão usará um template específico:
- **Confirmação de sessão:** `"Olá, {{nome_paciente}}! 😊 Passando para confirmar sua sessão amanhã, {{data_consulta}} às {{horario}}. Por favor, confirme sua presença. — {{nome_terapeuta}}"`  
- **Lembrete de pagamento:** `"Olá, {{nome_paciente}}! Passando para lembrar sobre o pagamento de R$ {{valor_sessao}} referente a {{mes_ref}}. Qualquer dúvida, estou à disposição. — {{nome_terapeuta}}"`

Esses textos são resolvidos com a função `resolveTemplate()` já existente.

---

## Arquivos a modificar

1. **`src/components/whatsapp/QuickWhatsAppButton.tsx`** — criar (componente reutilizável)
2. **`src/components/clinics/ClinicAgenda.tsx`** — adicionar botão de confirmação por paciente
3. **`src/pages/ClinicDetail.tsx`** — adicionar botão de confirmação na aba "Hoje"
4. **`src/components/clinics/ClinicFinancial.tsx`** — adicionar botão de lembrete de pagamento
5. **`src/components/dashboard/TodayAppointments.tsx`** — adicionar botão de confirmação

---

## Fluxo do Usuário

```text
Terapeuta abre "Agenda do Consultório"
  → Vê lista de pacientes do dia
  → Clica no ícone 🟢 WhatsApp ao lado do paciente
  → WhatsApp abre com mensagem já pronta:
    "Olá, João! Confirmando sua sessão hoje às 14h..."
  → Terapeuta envia com 1 toque

Terapeuta abre "Financeiro" → aba do mês
  → Vê pacientes com pagamento pendente
  → Clica no ícone 💬 WhatsApp ao lado
  → WhatsApp abre com mensagem de cobrança já pronta
  → Terapeuta envia com 1 toque
```

Sem cadastro extra, sem API paga, sem configuração — funciona imediatamente para todos os usuários.
