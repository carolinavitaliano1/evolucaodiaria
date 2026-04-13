

## Problema

Na coluna "Tipo" dos PDFs financeiros (extrato e relatório), todas as sessões aparecem como "Sessão", mesmo quando são sessões de grupo. O usuário quer ver "Grupo" quando a evolução tem `groupId`.

## Solução

Alterar a lógica de exibição da coluna "Tipo" em 3 pontos do arquivo `src/pages/Financial.tsx`:

1. **Linha 830** (Relatório Mensal PDF) — trocar:
   - `'Sessão'` → verificar se o paciente tem evoluções de grupo e exibir adequadamente

2. **Linha 1071** (Extrato de Clínica PDF) — trocar:
   - `patient.paymentType === 'fixo' ? 'Fixo' : 'Sessão'` → `patient.paymentType === 'fixo' ? 'Fixo' : (evo.groupId ? 'Grupo' : 'Sessão')`

3. **Linha 1228** (Exportação CSV) — ajustar a lógica do tipo para incluir "Grupo" quando aplicável

4. **Linha 1754** (UI tabela na página) — adicionar indicação visual de "Grupo" quando relevante

### Detalhes Técnicos

- A verificação é simples: se `evo.groupId` existe, o tipo é "Grupo"; caso contrário, segue a lógica atual ("Fixo" ou "Sessão")
- No relatório mensal (linha 830), onde a informação é por paciente (não por evolução), será necessário verificar se o paciente participa de grupos para mostrar "Sessão/Grupo" ou o tipo predominante

