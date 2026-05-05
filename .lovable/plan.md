## Objetivo

Tornar o formulário público de cadastro de funcionário (link compartilhável) idêntico ao cadastro manual feito dentro do app em **Colaboradores**, com todos os mesmos campos obrigatórios, e exibir esses dados na revisão do cadastro pendente.

## 1. Banco de dados

Migration adicionando colunas em `team_applications` (tudo nullable no schema, validação de obrigatório vai no frontend):

**Dados pessoais**
- `is_social_name` (bool, default false)
- `person_type` (text, default 'fisica')
- `sex`, `cpf`, `rg`, `marital_status`, `profession`
- `phone_landline`, `cellphone`

**Endereço**
- `country` (default 'Brasil'), `cep`, `state`, `city`, `street`, `number`, `district`, `complement`

**Bancário**
- `bank_name`, `bank_agency`, `bank_account`, `pix_type`, `pix_key`

**Preferências de contato**
- `allow_email_campaigns`, `allow_system_emails`, `pref_email`, `pref_sms`, `pref_whatsapp` (bool)

**Registro profissional**
- `professional_areas` (jsonb) — array `[{ area, council, councilNumber, councilUF, cbosCode }]`

A coluna existente `professional_id` continua para compatibilidade. RLS atual de `team_applications` não muda (insert público já funciona via RPC/insert anon, leitura restrita ao owner/admin da org).

## 2. Formulário público — `src/pages/TeamApplicationPublic.tsx`

Reescrever o conteúdo do `<form>` espelhando 1:1 o formulário do `ClinicCollaborators.tsx`, usando os mesmos componentes (`Input`, `Select`, `Checkbox`, máscaras, lista CBOS), organizados em 5 seções colapsáveis ou com títulos:

1. **Dados Pessoais** — Nome*, "É nome social" (checkbox), Tipo (PF), Data nascimento, Sexo (select), CPF* (máscara), RG, Estado civil, Profissão, E-mail*, Telefone fixo, Celular* (máscara)
2. **Endereço** — País, CEP* (máscara), Estado (UF), Cidade, Logradouro, Número, Bairro, Complemento
3. **Dados Bancários** — Banco*, Agência*, Conta*, Tipo de chave Pix*, Pix* (máscara conforme tipo)
4. **Preferência de Contato** — 5 checkboxes
5. **Registro do Profissional** — múltiplas áreas com Conselho, Nº, UF, CBOS (combobox com mesma lista padrão + opção "cadastrar nova função")

Reaproveitar as máscaras `maskCPF`, `maskCEP`, `maskPhone`, `maskPix`, lista `BR_STATES`, `COUNCILS`, `PIX_TYPES`, `DEFAULT_CBOS_OPTIONS` extraindo-as para `src/components/clinics/collaboratorFormUtils.ts` (compartilhadas entre os dois lugares).

Validação no submit: todos os campos marcados com `*` são obrigatórios + ao menos uma área profissional preenchida (Área + Conselho + Nº + CBOS). Mensagens de erro com `toast.error`.

Manter o gating atual (`linkEnabled`, `submitted`, etc.) e o layout em card centralizado, mas aumentar `max-w-lg` → `max-w-2xl` para acomodar campos em grid.

## 3. Painel de revisão — `src/components/clinics/TeamApplicationsPanel.tsx`

Expandir o card de cada cadastro pendente para mostrar:
- Linha de identidade (já existe): nome, e-mail
- **Pessoais**: CPF, RG, sexo, estado civil, profissão, nascimento, telefones
- **Endereço**: linha única formatada
- **Bancário**: banco/agência/conta + Pix
- **Áreas profissionais**: chips com `Área (Conselho Nº/UF · CBOS)`
- Preferências de contato como ícones

Ao aprovar (botão existente), `professional_areas[0].area` continua virando `role_label`/`specialties`, e `professional_id` é montado a partir do conselho da primeira área (`CRP 06/12345`). Os demais dados ficam armazenados em `team_applications` para futura migração para o perfil do membro.

## 4. Fora de escopo

- Sincronizar automaticamente todos os campos novos para `organization_members`/`profiles` na aprovação (fica para uma próxima iteração; só `role_label`/`specialties`/`professional_id` continuam migrando).
- Mudanças no cadastro manual em `ClinicCollaborators.tsx` (já tem todos os campos).
- Mudanças nas RLS ou no fluxo de convite por e-mail.
