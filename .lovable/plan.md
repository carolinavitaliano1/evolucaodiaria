

## Plano: Unificar "Cadastro via Link" com a ficha de matrícula completa

### Problema
O botão "Cadastro via Link" na página de Pacientes gera um link para `/cadastro-paciente/:token` (PatientIntakePublic.tsx), que é uma ficha simples. O formulário de matrícula da clínica (`/matricula/:clinicId` - Enrollment.tsx) é muito mais completo, com campos de responsável legal, responsável financeiro, menor de idade, etc. O usuário quer que ambos usem o **mesmo formulário completo**.

### Solução
Alterar o fluxo do "Cadastro via Link" para gerar o link de matrícula da clínica (`/matricula/:clinicId`) em vez de criar um rascunho e enviar para a ficha simplificada.

### Mudanças

#### 1. Simplificar `handleQuickReg` em `Patients.tsx`
- Remover a criação de paciente "rascunho" — o paciente será criado pela Edge Function `submit-enrollment` quando o responsável preencher o formulário completo
- Gerar o link diretamente como `https://evolucaodiaria.app.br/matricula/{clinicId}`
- Remover campos desnecessários do dialog (nome do paciente não é mais necessário, pois será preenchido pelo responsável)
- Manter apenas: seleção de clínica e WhatsApp (para envio)

#### 2. Atualizar o Dialog UI em `Patients.tsx`
- Ajustar labels e texto explicativo para refletir que o link agora leva ao formulário completo de matrícula
- O link gerado será o mesmo link que aparece dentro da clínica

### Arquivo afetado

| Arquivo | Ação |
|---|---|
| `src/pages/Patients.tsx` | Editar — simplificar dialog e gerar link de matrícula |

### Detalhes técnicos
- O link passa de `/cadastro-paciente/:token` para `/matricula/:clinicId`
- Não há mais criação de paciente rascunho — o `submit-enrollment` Edge Function já cria o paciente com status `pendente`
- O formulário de matrícula (Enrollment.tsx) já possui todos os campos necessários (dados pessoais, responsável legal, responsável financeiro, diagnóstico, etc.)

