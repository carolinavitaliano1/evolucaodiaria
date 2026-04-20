
User picked Option B — rateio proporcional.

**Plano:** Mostrar valor de rateio proporcional para pacientes de clínicas com salário fixo (`fixo_mensal` e `fixo_diario`) na coluna "Valor" do Controle de Pagamento por Paciente.

**Lógica do rateio:**
- Pegar o salário fixo da clínica no mês (R$ 1.200 para mensal; ou R$ valor_diario × dias trabalhados para diário)
- Somar todas as sessões realizadas (status `presente`, `reposicao`, `falta_remunerada`, `feriado_remunerado`) de todos os pacientes daquela clínica no mês
- Para cada paciente: `rateio = (sessões_do_paciente / total_sessões_clínica) × salário_fixo`
- Se total de sessões = 0, mostrar R$ 0,00

**Exibição na tabela (Financial.tsx):**
```
Ben | Viva | Fixo | 9 | — | R$ 600,00
                              (rateio)
```
Texto pequeno em cinza "(rateio)" abaixo do valor + tooltip explicando: *"Valor proporcional ao salário fixo da clínica (R$ 1.200,00). Não é receita adicional — apenas representa o peso deste paciente no salário."*

**Implementação técnica:**

1. **`src/utils/financialHelpers.ts`** — adicionar nova função:
   ```ts
   export function calculatePatientProportionalShare(ctx: {
     patient, clinic, allClinicPatients, allEvolutions, month, year
   }): { share: number; clinicSalary: number; isProportional: boolean }
   ```
   - Retorna `isProportional: true` apenas para `fixo_mensal`/`fixo_diario`
   - Calcula salário total e divide proporcionalmente por sessões

2. **`src/pages/Financial.tsx`** — na renderização da coluna "Valor":
   - Detectar se a clínica do paciente é fixa
   - Se sim: usar `calculatePatientProportionalShare` em vez de `calculatePatientMonthlyRevenue`
   - Renderizar valor + label "(rateio)" + tooltip
   - **Importante:** NÃO somar esses valores ao "Total Faturado" (continuariam sendo R$ 0 no agregado, pois o salário já é contado uma vez no card da clínica)

3. **Manter o card de receita da clínica** — o R$ 1.200 continua aparecendo uma única vez no nível da clínica (Faturamento Bruto). O rateio é puramente informativo na linha do paciente.

**Arquivos a editar:**
- `src/utils/financialHelpers.ts` (nova função)
- `src/pages/Financial.tsx` (renderização da coluna + tooltip)

**Validação esperada:** Ben e Carol (Viva, 9 sessões cada) → R$ 600 cada na linha do paciente, com label "(rateio)". Card da Viva continua R$ 1.200. Total Faturado do mês não duplica.
