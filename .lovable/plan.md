

# Plano: Editor Rico de Contratos com Variáveis Dinâmicas

## Contexto

O sistema atual de contratos usa um `<Textarea>` para edição de HTML bruto e suporta apenas `{{patient_name}}`. O pedido é evoluir para um editor de texto rico (Rich Text Editor) com variáveis clicáveis como "chips" e preenchimento automático no momento de gerar/enviar o contrato.

## O que será feito

### 1. Instalar TipTap (Rich Text Editor)
Adicionar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-mention` (para inserir variáveis como nodes inline).

### 2. Criar componente `ContractEditor`
Novo arquivo `src/components/contracts/ContractEditor.tsx`:
- Editor TipTap com toolbar (negrito, itálico, sublinhado, alinhamento, listas, headings)
- Painel lateral/dropdown **"Variáveis Disponíveis"** com chips clicáveis em tom roxo
- Ao clicar numa variável, ela é inserida no cursor como `{{nome_variavel}}` estilizada visualmente como chip inline
- Lista de variáveis:
  - `{{nome_paciente}}`, `{{cpf_paciente}}`, `{{rg_paciente}}`, `{{endereco_paciente}}`, `{{data_nascimento}}`
  - `{{nome_profissional}}`, `{{registro_profissional}}`, `{{data_atual}}`, `{{cidade_atual}}`
- Exporta HTML limpo via `editor.getHTML()`

### 3. Motor de Preenchimento (substituição de variáveis)
Atualizar `ContractManager.tsx` — função `handleSaveContract`:
- Buscar dados do paciente (`patients`: name, cpf, birthdate, address via intake_forms) e do terapeuta (`profiles`: name, professional_id; `stamps`: clinical_area/CBO; `clinics`: address/city)
- Substituir todas as tags `{{...}}` pelos valores reais antes de salvar em `patient_contracts.template_html`
- Manter compatibilidade com `{{patient_name}}` existente

### 4. Atualizar ContractManager — substituir Textarea pelo Editor Rico
- Trocar o `<Textarea>` (linha ~495-499) pelo novo `<ContractEditor>`
- Remover a nota sobre "HTML básico suportado" e substituir pelo painel de variáveis integrado
- O editor receberá `value` (HTML) e emitirá `onChange` (HTML)

### 5. Portal do Paciente — já funcional
A visão do paciente (`PortalContract.tsx`) já renderiza o HTML preenchido com `dangerouslySetInnerHTML`, exibe checkbox de consentimento obrigatório e bloqueia assinatura sem marcar. Não precisa de alteração significativa — o contrato já chega preenchido com dados reais.

## Detalhes técnicos

- **TipTap Mention extension** será customizado para renderizar variáveis como chips roxos (`bg-primary/10 text-primary border border-primary/30 rounded px-1.5 py-0.5 text-xs font-mono`)
- Os dados para preenchimento serão carregados via queries existentes (patients, profiles, stamps, clinics, patient_intake_forms)
- O `DEFAULT_BODY` será atualizado para usar as novas variáveis (`{{nome_paciente}}`, `{{nome_profissional}}`, etc.)
- Campos sem dado cadastrado serão substituídos por `[não informado]`

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/components/contracts/ContractEditor.tsx` | Criar — editor rico + painel de variáveis |
| `src/components/patients/ContractManager.tsx` | Editar — trocar Textarea pelo editor, adicionar motor de preenchimento |
| `package.json` | Editar — adicionar deps TipTap |

