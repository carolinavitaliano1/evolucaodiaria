
## Painel Financeiro da Equipe

### O que existe hoje
A página `Team.tsx` tem 3 abas: Equipe, Conformidade e Atividade.
O componente `TeamFinancialReport.tsx` já existe mas é usado dentro de `ClinicDetail` (aba Financeiro > sub-aba Equipe), **não** na página Equipe.

### O que será feito

Adicionar uma nova aba **"Financeiro"** na página `Team.tsx` que exibe um painel financeiro rico, com gráfico de evolução mensal e exportação de extrato em PDF.

---

### Estrutura do painel

```
Página Equipe
├── Equipe
├── Conformidade
├── Atividade
└── Financeiro  ← NOVA ABA
    ├── Navegação de mês + filtro por profissional
    ├── Cards de resumo (Faturamento, Sessões, Faltas Rem., Faltas)
    ├── Gráfico de barras: evolução dos últimos 6 meses (Recharts)
    ├── Ranking de profissionais (quem faturou mais)
    ├── Detalhamento por paciente (tabela)
    └── Botão "Exportar Extrato PDF"
```

---

### Componente a criar

**`src/components/clinics/TeamFinancialDashboard.tsx`**

- Reutiliza toda a lógica de cálculo já existente em `TeamFinancialReport.tsx`
- Adiciona: gráfico de barras dos **últimos 6 meses** com Recharts (`BarChart`) mostrando faturamento total e sessões por mês
- Ranking de profissionais com barra de progresso visual
- Botão "Exportar Extrato PDF" que gera um PDF completo com: cabeçalho, resumo do período, gráfico de evolução (tabela numérica dos 6 meses), ranking por profissional, detalhamento por paciente

---

### Alteração em `Team.tsx`

- Adicionar botão de aba `<DollarSign /> Financeiro` no seletor de abas
- Renderizar `<TeamFinancialDashboard clinicId={activeTeamClinicId} organizationId={organizationId} />` quando a aba estiver ativa

---

### Arquivos modificados
- `src/pages/Team.tsx` — adicionar aba Financeiro
- `src/components/clinics/TeamFinancialDashboard.tsx` — novo componente (criado do zero)

Sem mudanças de banco de dados — usa dados já disponíveis via `useApp()` e `useClinicOrg()`.
