## Objetivo

Reescrever o `AppointmentDialog` (usado **apenas em Clínica Pro**, dentro de `ClinicAgendaWeek`) seguindo o layout completo solicitado, mantendo todas as funcionalidades atuais e plugando às integrações reais que já existem no app.

Escopo: **somente Clínica Pro** (`clinic.type === 'clinica'`). A agenda de "Consultório" e "Contratante" não muda.

---

## Layout (de cima para baixo)

**Cabeçalho**
- Título "Novo agendamento" / "Editar agendamento" à esquerda.
- À direita: botão pequeno "Bloquear horário" (ícone corrente) que abre o `CalendarBlockDialog` já existente; botão "X" do shadcn fecha.

**Linha 1 — Data + Horário + Repetir**
- Input `Data:*` (`type=date`).
- Grupo "das [hora] às [hora]" com dois inputs `type=time`. Auto-preenche fim = início + 1h se vazio (lógica atual).
- Checkbox "Repetir" alinhado à direita; quando marcado, repete semanalmente (mesmo comportamento do `is_recurring` atual).

**Linha 2 — Encaixe**
- Checkbox "Realizar encaixe de horário para o atendimento" + ícone "?" com tooltip explicando: "Permite agendar mesmo se houver conflito de horário com outro atendimento". Salvo no campo `notes` como tag `[encaixe]` (sem migração).

**Linha 3 — Profissional**
- Select 100% largura com membros da clínica + suas especialidades em parênteses (já vêm do `useClinicOrg`).
- Link azul abaixo: "Verifique o horário de trabalho e o horário de intervalo de cada profissional." → abre modal `TherapistAgendaModal` existente (read-only para visualização rápida do horário).

**Linha 4 — Paciente**
- Combobox de busca de pacientes da clínica (mantém o atual, ocupando 100%).

**Linha 5 — Convênio + Senha/Autorização (grid 2 col)**
- Select Convênio: opções vindas de `health_plans` da clínica + opção fixa "Particular". Default: "Particular".
- Input "Senha/Autorização/Autenticador" + tooltip "?". Salvo em `notes` como tag `[autorizacao:VALOR]`.

**Linha 6 — Procedimento + Lançar no financeiro (grid 2 col)**
- Select Procedimento: opções vindas de `services` da clínica (nome + valor). Salvo em `notes` como `[procedimento:ID]`.
- Checkbox "Lançar atendimento no financeiro" centralizado verticalmente. Quando marcado e procedimento escolhido, ao salvar também cria um registro em `private_appointments` (mesma data/hora/paciente/valor/clinic_id) — usa o fluxo já existente de "Serviços" da clínica.

**Linha 7 — Status + Sala (grid 2 col)**
- Select Status: opções atuais (Agendado, Confirmado, Atendido, Faltou, Cancelado, Remarcar). Default Agendado.
- Select Sala: lê salas distintas já usadas em `appointments.room` da clínica (sem nova tabela). Permite digitar nova via opção "+ adicionar". Link azul abaixo: "+ Cadastrar sala" abre um mini-prompt para nomear (apenas adiciona à lista local; será persistida ao salvar o agendamento).

**Linha 8 — Celular + Lembretes (grid 3 col)**
- Input Celular com máscara `(##) #####-####`. Auto-preenche com telefone do paciente selecionado, mas editável.
- Select "Lembrete SMS": "Sem lembrete" (única opção real por enquanto, já que o app não tem SMS configurado — fica desabilitado com tooltip "Em breve").
- Select "Lembrete WhatsApp": "Sem lembrete" / "1h antes" / "1 dia antes". Salvo em `notes` como `[lembrete_wa:1h|1d]`. (Não enviamos automaticamente ainda — apenas registra a preferência; envio manual continua via botão WhatsApp existente.)

**Linha 9 — Observações**
- Textarea 100% largura. Mostra observações limpas (sem as tags internas `[encaixe]`, `[autorizacao:…]`, etc.). Tags são reanexadas ao salvar.

**Rodapé**
- Esquerda: link azul "⚙ Configurações da agenda" → navega para `/profile#agenda` (configurações de horário do usuário).
- Direita: "Fechar" (outline) e "Salvar" (primário).

---

## Persistência (sem migrações novas)

Tudo cabe nos campos existentes em `appointments`:

```
appointments: id, user_id, clinic_id, patient_id, date, time, end_time,
              therapist_user_id, status, room, convenio, notes, is_recurring
```

Campos sem coluna dedicada são serializados em `notes` no formato:
```
<observações do usuário>
---
[encaixe]
[autorizacao:ABC123]
[procedimento:<service_id>]
[lembrete_wa:1h]
[celular:11999999999]
```

Ao abrir para edição, o modal lê e separa as tags do texto livre. Ao salvar, reescreve o bloco abaixo do separador `---`.

Quando "Lançar no financeiro" estiver marcado **e** houver procedimento, criamos também um `private_appointments` com `service_id`, `price`, `clinic_id`, `patient_id`, `date`, `time`, `status='agendado'`.

---

## Integrações usadas (todas já existem)

- `health_plans` (filtrado por `clinic_id`).
- `services` (filtrado por `clinic_id`) com `name` e `price`.
- `members` da clínica via `useClinicOrg` (já tem `specialty`).
- `private_appointments` para lançamento financeiro.
- `CalendarBlockDialog` para "Bloquear horário".
- `TherapistAgendaModal` para link "Verifique o horário…".

---

## Arquivos a editar

- `src/components/clinics/AppointmentDialog.tsx` — reescrita completa do JSX e da lógica de save/load (mesma assinatura de props para não quebrar `ClinicAgendaWeek`).
- `src/components/clinics/ClinicAgendaWeek.tsx` — sem mudanças estruturais; apenas garante que o draft passa por todos os campos novos quando edita um existente.

Nenhuma migration de banco é necessária.

---

## Confirmar antes de implementar

1. Ok serializar autorização/encaixe/procedimento/lembrete dentro de `notes` (sem novas colunas)? Ou prefere migration que adicione colunas dedicadas (`authorization_code`, `is_encaixe`, `service_id`, `whatsapp_reminder`, `phone`)?
2. "Lançar no financeiro": ok criar entrada em `private_appointments` automaticamente quando marcado + procedimento escolhido?
3. "Cadastrar sala": ok manter como lista derivada (string livre + nova via prompt) ou prefere uma tabela `clinic_rooms` real?
