
## Problema

O usuário enviou um PDF do relatório financeiro onde há excesso de espaço vazio no final da primeira página que seria suficiente para caber o carimbo, mas ele foi empurrado para uma segunda página desnecessária.

## Causa raiz identificada

Analisando o código em `src/pages/PatientDetail.tsx` (funções `handleExportMonthlyPDF` e `handleExportFinancialPDF`):

- **Header block**: `y += 7` (título) + `y += 5` (subtítulo) + `y += 8` (após linha) = **20mm** só no cabeçalho
- **Seção de identificação**: cada campo `y += 6`, mais `y += 10` após o divisor = muita folga
- **Entre seções**: divisor `y + 2`, depois `y += 10` — 12mm entre cada seção
- **Título de seção**: `y += 8` para o título numerado
- **Linhas de dados**: `y += 6` cada uma + `y += 10` ao fechar a seção

Em `src/utils/generateReportPdf.ts`:
- `FOOTER_RESERVE = 28` — reserva 28mm de rodapé (excessivo, o rodapé usa ~6mm)
- `SECTION_GAP = 4` com `y += 7` por linha de heading + `y += 1` depois

## Solução

### 1. `src/pages/PatientDetail.tsx` — Reduzir espaçamentos em ambos os relatórios

```
Mudanças nos dois handlers (atendimento + financeiro):
- y += 7 após título → y += 6
- y += 8 após linha divisora do header → y += 6
- y += 6 por linha de identificação → y += 5
- y += 10 após divisor entre seções → y += 7
- y += 8 após título de seção numerada → y += 6
- y += 6 por linha de dados → y += 5
- y += 10 após divisor final → y += 7
- y += 9 por sessão (tabela de sessões) → y += 7
- Limite de quebra de página: y > 268 → y > 272
```

### 2. `src/utils/generateReportPdf.ts` — Reduzir reserva de rodapé e gaps

```
- FOOTER_RESERVE: 28 → 18
- USABLE_BOTTOM recalculado: 297 - 18 = 279
- SECTION_GAP: 4 → 3
- y += 7 por linha de heading → y += 6
- Numbered list y += 3 → y += 2
```

### 3. `addSignatureBlock` em `PatientDetail.tsx` — Ajustar estimativa de altura

Com os novos espaçamentos menores, o bloco de carimbo ficará menor na estimativa e caberá na página disponível.

## Arquivos a alterar

- `src/pages/PatientDetail.tsx` — seções de header, identificação, seções numeradas e tabela de sessões nos dois handlers de PDF
- `src/utils/generateReportPdf.ts` — constantes de espaçamento e reserva de rodapé
