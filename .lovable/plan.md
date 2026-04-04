

## Plano: Download de PDF para Fichas e Questionários Preenchidos

### Objetivo
Permitir baixar PDFs profissionais das fichas (intake) e questionários preenchidos, com cabeçalho completo (clínica, terapeuta, paciente, responsável, diagnóstico).

### Mudanças

#### 1. Criar utilitário `src/utils/generateQuestionnairePdf.ts`

Função reutilizável que gera PDF com `jsPDF` contendo:
- **Cabeçalho**: Timbrado da clínica (se houver `letterhead`), nome da clínica/consultório, endereço, CNPJ, telefone, e-mail
- **Dados do paciente**: Nome, data de nascimento, diagnóstico, área clínica
- **Responsável legal** (se menor): Nome, parentesco
- **Terapeuta**: Nome, registro profissional, área clínica
- **Corpo**: Título do questionário/ficha, perguntas e respostas formatadas (seções, separadores)
- **Rodapé**: Data de preenchimento, data de geração, carimbo/assinatura digital do terapeuta (se disponível)

Aceita parâmetros genéricos para servir tanto a ficha de anamnese quanto questionários:
```text
generateQuestionnairePdf({
  title, sections, clinicInfo, patientInfo, therapistInfo, stamps
})
```

#### 2. Atualizar `handleDownloadIntake` no `PortalTab.tsx`

- Carregar dados extras do paciente (`diagnosis`, `clinical_area`, `is_minor`, `guardian_name`, `guardian_kinship`, `birthdate`) e da clínica (`name`, `address`, `cnpj`, `phone`, `email`, `letterhead`) via Supabase no momento do download
- Carregar perfil do terapeuta (`name`, `professional_id`) e stamps
- Usar a nova função `generateQuestionnairePdf` em vez do código inline atual

#### 3. Adicionar botão "Baixar PDF" nos questionários preenchidos

No bloco de questionários enviados (linha ~836), adicionar um botão `Download` ao lado de "Ver" quando `status === 'submitted' || status === 'reviewed'`. Ao clicar:
- Carrega dados do paciente/clínica/terapeuta (mesma lógica)
- Chama `generateQuestionnairePdf` passando `q.title`, `q.fields` e `q.answers`

#### 4. Adicionar botão "Baixar PDF" no portal do paciente (`PortalIntakeForm.tsx`)

Na lista de questionários preenchidos pelo paciente, adicionar botão para baixar o PDF das respostas submetidas (versão simplificada sem carimbo do terapeuta).

### Detalhes Técnicos

- O PDF carrega o `letterhead` como imagem no topo (padrão já usado em `generateReportPdf.ts` e `generateEvolutionPdf.ts`)
- Stamps/assinatura seguem o mesmo padrão de `generateEvolutionPdf.ts` (carrega da tabela `stamps`)
- Dados do paciente/clínica são buscados sob demanda no clique do download (sem carregar previamente)
- Perguntas do tipo `select`/`yesno` mostram a resposta formatada; `textarea` quebra em múltiplas linhas

### Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/utils/generateQuestionnairePdf.ts` | **Criar** — função de geração do PDF |
| `src/components/patients/PortalTab.tsx` | **Editar** — refatorar `handleDownloadIntake`, adicionar download nos questionários |
| `src/pages/portal/PortalIntakeForm.tsx` | **Editar** — adicionar botão de download para o paciente |

