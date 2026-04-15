

# Seções Personalizáveis nas Informações do Grupo

## Objetivo
Permitir que o terapeuta adicione, edite nomes/subtítulos, e exclua as seções (categorias) da aba "Informações" do grupo terapêutico, além das 4 seções padrão (Visão Geral, Estrutura, Critérios, Acompanhamento).

## Abordagem

Usar uma coluna JSONB `custom_sections` na tabela `therapeutic_groups` para armazenar seções personalizadas. As 4 seções padrão continuam mapeadas às colunas existentes, mas agora com nomes editáveis. A estrutura JSONB armazena tanto os nomes customizados das seções padrão quanto seções totalmente novas.

## Estrutura de dados

```json
{
  "renamed_defaults": {
    "overview": "Meu Título Personalizado",
    "structure": null,
    "criteria": "Regras Internas",
    "tracking": null
  },
  "hidden_defaults": ["criteria"],
  "custom": [
    {
      "id": "uuid",
      "title": "Dinâmicas do Grupo",
      "fields": [
        { "label": "Atividade principal", "value": "Role-playing" },
        { "label": "Frequência de revisão", "value": "Quinzenal" }
      ]
    }
  ]
}
```

## Plano de implementação

### 1. Migração do banco de dados
- Adicionar coluna `custom_sections jsonb DEFAULT '{}'` à tabela `therapeutic_groups`.

### 2. Refatorar a aba Informações (GroupDetail.tsx)
- Renderizar as 4 seções padrão usando nomes do `custom_sections.renamed_defaults` (fallback para os nomes originais).
- Ocultar seções padrão listadas em `hidden_defaults`.
- Renderizar seções custom após as padrão, cada uma como um Accordion com seus campos dinâmicos.
- Adicionar botão de edição (lápis) em cada seção para renomear ou excluir.
- Adicionar botão "+ Nova Seção" no final para criar seções custom com título e campos livres.

### 3. Modal/Dialog de edição de seção
- Para seções padrão: editar nome, opção de ocultar (não deletar dados).
- Para seções custom: editar nome, adicionar/remover/editar campos (label + valor textarea), deletar a seção inteira.

### 4. Persistência
- Salvar `custom_sections` via update na tabela `therapeutic_groups` ao confirmar edições.
- Atualizar o `GroupData` interface e o `TherapeuticGroupsTab` form para incluir o novo campo.

## Detalhes técnicos
- **Migração**: `ALTER TABLE therapeutic_groups ADD COLUMN custom_sections jsonb DEFAULT '{}'::jsonb;`
- **Tipagem**: Nova interface `CustomSections` com `renamed_defaults`, `hidden_defaults` e `custom` arrays.
- **Arquivos modificados**: `src/pages/GroupDetail.tsx`, `src/components/clinics/TherapeuticGroupsTab.tsx`
- **Sem nova tabela**: tudo fica no JSONB para simplicidade e performance.

