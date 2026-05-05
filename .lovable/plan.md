## Objetivo

Deixar o card "Personalize as permissões de acesso aos recursos" (cadastro novo + editar permissões) **igual ao layout que você descreveu**, com toggles Sim/Não visíveis diretamente — sem precisar abrir "Permissões avançadas". E aplicar **regras inteligentes de clínica** entre as opções para que nenhuma combinação fique sem sentido.

---

## 1. Layout final do card (cadastro + edição)

Ordem exata, como você descreveu:

```text
Personalize as permissões de acesso aos recursos

Função *
( ) Administrador
( ) Profissional        ← agrupado, mostra "Tipo de profissional" abaixo quando selecionado
( ) Secretária(o)
( ) Financeiro completo
( ) Financeiro individual
( ) Financeiro consulta
( ) Marketing
( ) Auditor / Fiscal

— quando Função = Profissional —
Tipo de profissional:
( ) Completo   ( ) Limitado

——— Permissões granulares (toggles Sim/Não) ———

Pode editar ou arquivar pacientes?           [ Não  ◯  Sim ]
Pode excluir atendimentos?                   [ Não  ◯  Sim ]
   Permite excluir atendimentos registrados por ele.
Pode editar avaliações e evoluções?          [ Não  ◯  Sim ]
   Permite editar avaliações e evoluções.
Pode transcrever atendimentos em áudio?      [ Não  ◯  Sim ]
   Permite transcrever atendimentos gravados em áudio.
Pode aprovar atendimentos de limitados?      [ Não  ◯  Sim ]
   Permite aprovar atendimentos de profissionais limitados.
```

Os toggles ficam **sempre visíveis**, não escondidos.
O painel "Permissões avançadas" continua disponível, mas reduzido a um link discreto: **"Personalizar módulos (Clínico, Financeiro, Agenda, IA, Relatórios)"** — para quem quiser mexer fino.

---

## 2. Regras inteligentes entre opções (a parte que faz sentido clínico)

| Quando o usuário seleciona... | O que acontece automaticamente |
|---|---|
| **Administrador** | Todos os 5 toggles vão para **Sim** e ficam **bloqueados** (admin sempre tem tudo). Aviso: "Administrador tem acesso total." |
| **Profissional · Completo** | Padrões: editar pacientes = **Sim**, excluir atendimentos = **Sim**, editar evoluções = **Sim**, transcrever = **Sim**, aprovar limitados = **Não**. Tudo editável. |
| **Profissional · Limitado** | Padrões: editar pacientes = **Não**, excluir = **Não**, editar evoluções = **Não**, transcrever = **Sim**, aprovar limitados = **Não** (e fica **bloqueado em Não** — limitado nunca aprova). Mostra aviso amarelo: "Atendimentos deste usuário precisam ser aprovados por um profissional completo ou administrador." |
| **Secretária(o)** | editar pacientes = **Sim** (cadastrar/editar dados cadastrais), excluir atendimentos = **Não**, editar evoluções = **Não** e **bloqueado** (secretária nunca edita prontuário), transcrever = **Não**, aprovar limitados = **Não** e **bloqueado**. |
| **Financeiro completo / individual / consulta** | Todos os 5 toggles ficam **Não** e **bloqueados** (perfil financeiro não atua no clínico). Único toggle ativo: nenhum — só vê a aba financeira definida pelo perfil. |
| **Marketing** | Todos os 5 toggles **Não** e **bloqueados**. Marketing só vê dados não-sensíveis. |
| **Auditor / Fiscal** | Todos os 5 toggles **Não** e **bloqueados** (auditor é somente leitura por definição). |

### Regras de coerência (não dependem do perfil)

- **"Aprovar atendimentos de limitados" = Sim** só pode ser ligado se o usuário **NÃO** for "Profissional · Limitado". Se o usuário muda de Completo → Limitado, este toggle vira automaticamente Não.
- **"Editar avaliações e evoluções" = Sim** exige que o usuário tenha pelo menos `evolutions.view` (garantido por todos os perfis exceto Financeiro/Marketing — que já estão bloqueados acima).
- **"Excluir atendimentos" = Sim** só faz sentido se o usuário pode criar/editar atendimentos (perfis clínicos). Bloqueado nos perfis administrativos onde o toggle já está em Não.
- Quando o usuário troca de função, os toggles são **recalculados** para o padrão dessa função (com aviso "Padrões da função aplicados — você pode personalizar").

---

## 3. Mudanças técnicas (resumo)

### `src/hooks/useOrgPermissions.ts`
- Acrescentar função utilitária `getRolePermissionDefaults(roleId)` que devolve `{ canEditPatients, canDeleteAppointments, canEditEvolutions, canTranscribeAudio, canApproveLimited, locked: { … } }` aplicando as regras da tabela acima.
- Manter `PRESET_ROLES` e `PERMISSION_GROUPS` como hoje (continuam usados pelo PermissionEditor avançado).

### `src/components/clinics/ClinicUsers.tsx`
- Substituir o atual bloco "Pode editar ou arquivar pacientes?" + painel "Permissões avançadas" por **5 toggles Sim/Não em coluna**, todos sempre visíveis, dirigidos por `getRolePermissionDefaults`.
- Cada toggle aceita `disabled` quando a regra trava o valor; mostra um pequeno cadeado e tooltip "Definido pela função selecionada".
- Quando o usuário troca a função, recalcula os 5 estados; quando o usuário desmarca um lock manualmente em uma função permissiva, mantém a escolha dele.
- Aviso visual amarelo abaixo dos toggles quando `professional.limited` está ativo, explicando o fluxo de aprovação.
- O painel `PermissionEditor` (módulos Clínico, Financeiro, Agenda, IA, Relatórios) continua existindo, mas só abre via link discreto **"Personalizar módulos avançados"** abaixo dos toggles.
- O mesmo bloco é renderizado dentro do **modal de Editar permissões** do usuário existente (componente compartilhado para cadastro e edição).
- Ao salvar, os 5 toggles são traduzidos para as `PermissionKey` correspondentes (`patients.archive`, `appointments.delete_own`, `evaluations.edit`, `audio.transcribe`, `limited.approve`, `professional.limited`) e mesclados ao array de `permissions`.

### Componente reutilizável
- Criar `src/components/clinics/UserAccessPermissions.tsx` com o card completo (Função + Tipo + 5 toggles + link avançado) que recebe `value`/`onChange` de `{ roleId, permissions }`. Usado tanto no cadastro quanto no modal de edição — uma única fonte de verdade.

---

## 4. Fora de escopo

- Não cria novas tabelas nem altera o backend (`organization_members.permissions` continua armazenando `PermissionKey[]`).
- Não muda o fluxo de convite por e-mail (edge function `invite-member` segue recebendo o array final de permissões).
- Não toca em outras telas que consomem `useOrgPermissions` — o gating no resto do app continua reagindo às mesmas chaves.
