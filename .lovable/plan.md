
## Objetivo

Remodelar o sistema de **Reposição/Avulso** na agenda e prontuário, com 4 mudanças principais:

1. **Remover "Sessão regular"** do seletor de tipo ao agendar (já existe agendamento normal por outras vias).
2. Permitir **Anteposição** (sessão antecipada) vinculada a uma falta futura específica.
3. Mostrar **descrição visual** (Avulso / Reposição / Anteposição) na agenda, na aba Sessões do prontuário e na lista de pendências.
4. Gerar **alerta de evolução pendente** para avulsas/reposições/anteposições **confirmadas/cobradas** sem evolução registrada.

---

## 1. Tipos de sessão (novo modelo)

Tipos disponíveis ao agendar via "Agendar Atendimento":

- **Sessão avulsa** — atendimento pontual fora do plano recorrente.
- **Reposição** — repõe uma falta **passada** (já registrada como `falta` no prontuário).
- **Anteposição** — adianta uma sessão de uma data **futura** que será falta (ex: paciente avisa que vai faltar dia 10, e antecipa a sessão para o dia 5).

A opção **"Sessão regular"** será removida do seletor — agendamentos regulares continuam acontecendo automaticamente pelo `scheduleByDay` do paciente.

---

## 2. Vincular Reposição/Anteposição a uma falta original

Quando o usuário escolher **Reposição** ou **Anteposição**, aparece um seletor extra:

- **Reposição** → lista as faltas (`attendance_status = 'falta'`) **anteriores** à data do agendamento, ainda não repostas.
- **Anteposição** → lista as faltas **posteriores** à data do agendamento (faltas planejadas/confirmadas que o paciente já avisou).

O usuário escolhe qual falta está sendo reposta/anteposta. O sistema:

- Marca a evolução criada com a tag `[reposicao:<evolution_id>]` ou `[anteposicao:<evolution_id>]` no campo `text` (e `attendance_status='reposicao'`).
- Marca a evolução-falta original com `[reposta_por:<id>]` para evitar dupla vinculação.

> **Nota:** Como o tipo "Anteposição" não existe em `attendance_status`, ela continua sendo gravada como `reposicao` no banco (mantém a contagem para receita), mas a UI a apresenta como "Anteposição" via tag no texto.

---

## 3. Descrição visual (badges)

### a) Card da agenda (Calendar.tsx)
Adicionar badge ao lado do nome do paciente quando o `appointment.notes` contiver tag de tipo:
- `[tipo:avulsa]` → badge **"Avulso"** (cor laranja).
- `[tipo:reposicao]` → badge **"Reposição"** (cor azul).
- `[tipo:anteposicao]` → badge **"Anteposição"** (cor roxa).

### b) Aba Sessões do prontuário (PatientDetail.tsx)
Na lista/tabela de evoluções, mostrar a tag colorida (mesma paleta acima) ao lado da data, derivada do conteúdo do `text` da evolução (`[reposicao:..]`, `[anteposicao:..]`, `[tipo:avulsa]`).

### c) Lista de pendências (MissingEvolutionsAlert.tsx)
Exibir o tipo no item da pendência: "Maria às 14:00 · Reposição · sem evolução".

---

## 4. Alerta de evolução pendente

Hoje o `MissingEvolutionsAlert` só considera **sessões recorrentes** (via `scheduleByDay`) e ignora avulsas/reposições.

Mudança: incluir como candidatos a pendência os **`appointments`** cujas `notes` contenham `[tipo:avulsa]`, `[tipo:reposicao]` ou `[tipo:anteposicao]` **E** estejam marcados como cobrados/confirmados (ou seja, tenham um `private_appointments` correspondente OU uma flag de confirmação no agendamento).

Critério prático de "confirmada/cobrada":
- Existe `private_appointments` para o mesmo `patient_id + date + time`, OU
- O agendamento foi criado com `chargeEnabled = true` (já registra `private_appointments`).

Para esses, se não existir evolução em `(patient_id, date)` após o horário de fim, entra na lista de pendências como qualquer sessão regular.

---

## Detalhes técnicos

### Arquivos a editar

- **`src/pages/Calendar.tsx`**
  - Remover `'regular'` do `sessionType` (default vira `'avulsa'`).
  - Remover `<SelectItem value="regular">` e ajustar lógica `isAvulsaOrReposicao` para sempre `true`.
  - Adicionar opção `'anteposicao'` no Select.
  - Adicionar segundo Select condicional: "Vincular à falta" — popular com evoluções `falta` do paciente filtradas por data (anteriores se reposição, posteriores se anteposição). Mostrar data/horário da falta.
  - Ao submeter:
    - `typeTag` agora cobre `[tipo:anteposicao]`.
    - `text` da evolução criada inclui `[reposicao:<id>]` ou `[anteposicao:<id>]` se vinculada.
    - Atualizar a evolução-falta original adicionando `[reposta_por:<nova_id>]` no `text`.
  - Adicionar badge visual no `CalItem` (renderização do card na agenda) lendo a tag do `notes`.

- **`src/components/dashboard/MissingEvolutionsAlert.tsx`**
  - Carregar `private_appointments` do período (ou cruzar com `appointments` cujas notes tenham `[tipo:...]`).
  - Para cada `appointment` "cobrado/confirmado" sem evolução correspondente, criar um `PendingEntry` com campo extra `kind: 'avulsa' | 'reposicao' | 'anteposicao'`.
  - Renderizar o tipo no texto do item ("Reposição · sem evolução").

- **`src/pages/PatientDetail.tsx`** (aba Sessões / lista de evoluções)
  - Função utilitária para extrair tipo (`avulsa | reposicao | anteposicao | regular`) do campo `text` ou do `appointment.notes` correspondente.
  - Renderizar badge ao lado da data/horário de cada evolução listada.

- **`src/components/evolutions/EditEvolutionDialog.tsx`** (opcional, leve)
  - Quando `attendanceStatus === 'reposicao'`, mostrar um pequeno seletor para vincular/alterar a falta original (mesma lógica do Calendar). Isso permite registrar reposição/anteposição diretamente pelo prontuário também, sem precisar passar pela agenda.

### Sem mudanças de schema

- A coluna `attendance_status` continua com os 6 valores existentes; **anteposição reusa `'reposicao'`** + tag no `text`.
- Vínculo entre reposição e falta original também via tag no `text` (não exige nova coluna). Isso preserva todas as queries de receita (`get_patient_monthly_revenue`) sem migração.
- Se o usuário pedir relatórios/contagens dedicadas mais tarde, criamos coluna `replaces_evolution_id uuid` em uma migration separada.

### Cores dos badges (semantic tokens)

- Avulso → `bg-orange-100 text-orange-800 border-orange-300`
- Reposição → `bg-blue-100 text-blue-800 border-blue-300`
- Anteposição → `bg-purple-100 text-purple-800 border-purple-300`

(Mantendo o padrão já usado no `EVENT_COLORS` da agenda.)

---

## Fora de escopo

- Migration para criar coluna formal de vínculo (faremos só se você pedir relatórios cruzados depois).
- Notificação push/WhatsApp da pendência (já existe outro fluxo).
- Mudança no Compliance Dashboard (continua usando regra própria de 24h).
