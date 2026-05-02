## O que vai mudar

Hoje a opção **"Cobrar apenas se houve confirmação prévia"** já existe no cadastro da clínica e a lógica financeira (`shouldBillEvolution`) já respeita o campo `confirmedAttendance`. Porém, não há nenhum lugar para o terapeuta **registrar a confirmação ANTES da sessão acontecer** — hoje o campo só é salvo junto com a evolução, o que torna a regra impossível de aplicar na prática.

Este plano adiciona o registro de confirmação prévia diretamente na **Agenda da Clínica**.

## Funcionamento

1. **Cada paciente agendado do dia** ganha um botão **"Confirmar presença"** ao lado do botão de WhatsApp existente.
2. Ao clicar, é criado um registro de "pré-confirmação" para aquele paciente naquela data. O botão troca para um **badge verde "✓ Confirmado"** (clicável para desfazer).
3. Quando a evolução for criada depois (presente ou falta), ela herda automaticamente o `confirmedAttendance = true` se houver pré-confirmação para a data.
4. O botão fica disponível **até o fim do dia da sessão** (00h do dia seguinte). Após isso, vira somente leitura.
5. **Resultado financeiro:** em clínicas com modo "Cobrar apenas se houve confirmação prévia":
   - Falta **com** pré-confirmação → cobra (vira receita / desconto parcial conforme `absence_charge_mode`).
   - Falta **sem** pré-confirmação → não cobra (entra em "Total Descontado").

## Onde aparece

- **Componente:** `src/components/clinics/ClinicAgenda.tsx` — bloco de cada paciente agendado e bloco de `oneOffAppointments` (serviços avulsos).
- Visual: badge verde `✓ Confirmado` junto do status, ao lado do botão WhatsApp.
- Tooltip explicativo no botão deixando claro o impacto financeiro quando a clínica está em modo `confirmed_only`.

## Detalhes técnicos

### Nova tabela `attendance_confirmations`
Campos relevantes:
- `patient_id`, `clinic_id`, `date`, `confirmed_by_user_id`, `confirmed_at`
- Único por (`patient_id`, `clinic_id`, `date`)
- RLS: dono da clínica + membros da organização da clínica podem inserir/ler/excluir.

Motivo de tabela separada (em vez de reusar `evolutions.confirmed_attendance`): a evolução só existe depois da sessão; precisamos do registro **antes**.

### Integração com a criação de evolução (`AppContext.tsx` `addEvolution`)
- Antes de inserir a evolução, consultar `attendance_confirmations` para `(patient_id, clinic_id, date)`.
- Se existir, forçar `confirmed_attendance = true` no insert (sobrescreve o default).
- Não alterar evoluções já existentes — apenas o caminho de criação.

### UI em `ClinicAgenda.tsx`
- Carregar via `useEffect` as confirmações da `viewDate` para a `clinicId`.
- Função `toggleConfirmation(patientId)`: insere ou remove o registro otimisticamente.
- Botão fica desabilitado se `viewDate < hoje` (passado) — só permite marcar para hoje ou futuro.
- Badge verde `✓ Confirmado` substitui o estado padrão "⏳ Aguardando" quando a confirmação existe e não há evolução ainda.
- Quando já existe evolução, badge de confirmação aparece pequeno ao lado do status atual (informativo).

### Aviso visual contextual
- Se a clínica está com `absence_payment_type = 'confirmed_only'`, mostrar uma faixa pequena no topo da agenda explicando: *"Esta clínica cobra faltas apenas quando houve confirmação prévia. Use o botão ✓ para registrar."*

### Sem mudanças na lógica financeira
- `financialHelpers.ts`, `fiscalTotals.ts`, `PatientBillingManager.tsx`, `PatientDetail.tsx`, `generateClinicInternalStatementPdf.ts` continuam inalterados — eles já respeitam `confirmedAttendance` corretamente. A mudança apenas garante que esse campo seja preenchido a partir das pré-confirmações.

### Memory
- Adicionar memory `mem://features/attendance-pre-confirmation` documentando o fluxo: tabela `attendance_confirmations`, regra de cobrança em modo `confirmed_only`, herança automática do flag na criação da evolução.

## Não inclui
- Notificações automáticas / lembretes (regra de "não usar push reminders" do projeto).
- Confirmação pelo paciente via portal (escopo futuro, se desejado).
- Mudanças em relatórios PDF — os totais já refletirão corretamente porque a lógica financeira não muda.
