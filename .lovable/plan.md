## Módulo de Supervisão Clínica

Novo módulo add-on (R$ 39/mês, incluído nos planos Pro/Clínica Pro como os demais) para profissionais que prestam supervisão a outros profissionais/estagiários.

### 1. Área própria "Supervisão" no menu

Nova página `/supervisao` com lista de **supervisionandos** (parecida com Pacientes):

- Cadastro: nome, e-mail, WhatsApp, formação, conselho/registro (CRP, CREFITO...), abordagem, tipo de vínculo (**externo** ou **membro da equipe** — neste caso vinculado a `organization_members`), início, status (ativo/encerrado).
- Ficha do supervisionando com abas: Sessões, Plano de Desenvolvimento, Horas & Certificado, Financeiro, Casos, Documentos.

### 2. Sessões de supervisão

- Data, hora início/fim (duração calculada automaticamente), modalidade (individual / grupo / online / presencial).
- Temas discutidos, casos abordados, encaminhamentos/tarefas para o supervisionando, observações de conduta ética.
- Presença: presente / falta / falta cobrada / remarcada (mesmo padrão de status usado em evoluções).
- Anexos e assinatura/carimbo do supervisor (reaproveita `stamps`).
- Geração de texto/resumo com IA (Lovable AI Gateway), no mesmo padrão das evoluções.
- Exportação em PDF do registro da sessão.

### 3. Plano de desenvolvimento do supervisionando

- Metas por competência (avaliação clínica, manejo de caso, escrita de documentos, ética, teoria) com prazo e status.
- Escala 0–5 por competência, com gráfico radar de evolução entre avaliações periódicas.
- Checklist de objetivos atingidos e feedback escrito do supervisor.

### 4. Horas e certificados

- Contador automático de horas acumuladas (soma das sessões com presença), separado por modalidade (individual/grupo).
- Meta de horas configurável (ex.: exigência do conselho) com barra de progresso.
- Emissão de **Declaração/Certificado de Supervisão** em PDF A4 com carimbo e assinatura, listando período, total de horas e detalhamento por sessão.

### 5. Financeiro e agenda

- Valor por sessão ou mensalidade por supervisionando; dia de vencimento.
- Registro de pagamentos e status (pago/pendente/atrasado), no padrão de `patient_payment_records`.
- Recorrência semanal/quinzenal com horário, alimentando o Calendário existente e o alerta de sessões do Dashboard.
- Receita de supervisão entra como categoria própria nos Relatórios/Financeiro (não mistura com repasse de clínica).

### 6. Supervisão de casos (aba no paciente)

- Nova aba "Supervisão" no prontuário do paciente (dentro de Especialidades, padrão atual dos módulos).
- Registro de discussão do caso: hipóteses, condutas sugeridas, riscos identificados, supervisor responsável e data.
- Vínculo opcional com a sessão de supervisão correspondente e com o supervisionando que apresentou o caso.
- Visível apenas para supervisor e supervisionando vinculado (RLS), nunca no Portal do Paciente.

### Detalhes técnicos

- `src/modules/specialties/config.ts`: novo módulo `supervisao` (ícone `UserCheck`, `status: 'available'`, R$ 39, `stripePriceId` novo a criar no Stripe) e adicionar ao `MODULE_PRICES` de `create-module-checkout`.
- Acesso via `has_module_access('supervisao')` — nenhuma mudança na função é necessária.
- Novas tabelas (todas com GRANTs + RLS por `user_id` do supervisor, e leitura para o supervisionando quando ele for membro da organização):
  - `supervisees` — dados do supervisionando, `member_id` opcional, valores e recorrência.
  - `supervision_sessions` — data, horários, modalidade, presença, conteúdo, IA, carimbo.
  - `supervision_goals` — metas/competências, escala, status.
  - `supervision_payments` — cobranças e pagamentos.
  - `supervision_case_notes` — discussão de caso ligada a `patients`.
- Rota `/supervisao` + item no `AppSidebar` e `MobileNav`, exibido apenas com acesso ao módulo.
- PDFs reaproveitam o padrão de `generateAIDocumentPdf` / `generateReportPdf` (A4, carimbo, texto justificado).

### Entrega sugerida em duas fases

1. **Fase 1**: módulo + tabelas + área `/supervisao` com supervisionandos, sessões, horas e certificado em PDF.
2. **Fase 2**: plano de desenvolvimento com radar, financeiro/agenda recorrente e aba de supervisão de caso no paciente.
