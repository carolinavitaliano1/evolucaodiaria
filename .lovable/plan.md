

# Sessão Terapêutica em Grupo — Humor e Sentimentos por Participante

## Resumo
Criar um componente dedicado `GroupSessionTab` para a página de detalhe do grupo que replique a funcionalidade da sessão individual (`TherapeuticSessionTab`) mas com avaliação clínica **por participante**: humor, sentimentos positivos e negativos individualizados, além de campos compartilhados do grupo (notas, planos, comentários).

## O que muda para o usuário
- Na aba "Sessão" do grupo, ao iniciar sessão, aparece:
  - **"Humor do grupo"** — seção com um bloco por participante: "Humor [Nome]" com seletor de emoji 1-10
  - **"Sentimentos do grupo"** — seção com um bloco por participante: "Sentimentos [Nome]" com positivos e negativos separados
  - Pensamentos suicidas — toggle individual por participante
- Campos compartilhados: título da sessão, cronômetro, anotações, planos de ação, próxima sessão, comentários gerais, arquivos, evolução IA
- O save/auto-save persiste os dados por participante em JSONB na sessão

## Arquivos a criar/editar

### 1. Migração SQL
Adicionar colunas à tabela `therapeutic_sessions` (ou criar se não existir para grupos):
- `group_id uuid` (nullable, FK → therapeutic_groups) para vincular sessões ao grupo
- `participants_data jsonb` — armazena humor/sentimentos/suicidal por participante:
```json
{
  "patient-uuid-1": { "mood_score": 7, "positive_feelings": ["esperança"], "negative_feelings": ["ansiedade"], "suicidal_thoughts": false },
  "patient-uuid-2": { "mood_score": 5, "positive_feelings": [], "negative_feelings": ["tristeza"], "suicidal_thoughts": false }
}
```

### 2. `src/components/clinics/GroupSessionTab.tsx` (novo)
Componente inspirado no `TherapeuticSessionTab` com:
- **Props**: `groupId`, `groupName`, `clinicId`, `members: MemberPatient[]`
- **State**: `participantsData: Record<string, { moodScore, positiveFeelings, negativeFeelings, suicidalThoughts }>` — inicializado com um entry por membro
- **UI da avaliação clínica**:
  - Card "Humor do grupo" — itera `members`, renderiza "Humor [nome]" + emoji selector por participante
  - Card "Sentimentos do grupo" — itera `members`, renderiza "Sentimentos [nome]" com sub-seções positivos/negativos
  - Toggle de pensamentos suicidas por participante (com alerta visual)
- Timer, notas, planos de ação, próxima sessão, comentários gerais, arquivos, evolução IA — campos compartilhados (mesma lógica do individual)
- Save: persiste `participants_data` como JSONB + campos compartilhados
- Histórico: lista sessões do grupo com resumo de humor por participante

### 3. `src/pages/GroupDetail.tsx`
- Adicionar tab "Sessão" (ícone `PenLine`) no array de tabs
- Renderizar `<GroupSessionTab>` passando `groupId`, `groupName`, `clinicId`, `members`

## Fluxo de dados
1. Terapeuta abre grupo → aba Sessão → "Iniciar Sessão"
2. Timer inicia, form exibe blocos por participante para humor e sentimentos
3. Auto-save a cada 60s persiste JSONB com dados individualizados
4. "Finalizar Sessão" salva e gera evolução IA consolidada

