## Objetivo

Unificar tudo que é financeiro da clínica dentro da aba **Financeiro** de `/clinics/:id`, organizado em **sub-abas em cards** no mesmo estilo visual da barra de abas principal da clínica (cards com ícone colorido + label).

Hoje está espalhado:
- **Financeiro** (aba atual) → receita da clínica, cobranças de pacientes, serviços particulares
- **Pacotes** (aba separada) → CRUD de pacotes
- **Equipe → Financeiro** (em `/team`) → remuneração da equipe e planos de remuneração

## O que muda

### 1. Aba "Pacotes" deixa de existir como aba principal
- Removida do array de tabs em `ClinicDetail.tsx` (linha ~1347).
- Todo o conteúdo (CRUD, dialogs de criar/editar, exportação CSV/PDF, modal de pacientes do pacote) é movido para um novo componente `ClinicPackagesPanel` e renderizado dentro de uma sub-aba do Financeiro.

### 2. Aba "Financeiro" passa a ter 4 sub-abas em cards

Layout idêntico ao grid de abas principais (cards com ícone colorido, borda, bg-card, hover):

```text
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  💰         │  👥         │  🧑‍⚕️       │  📦         │
│ Visão Geral │  Pacientes  │   Equipe    │  Pacotes    │
│ (success)   │  (violet)   │ (fuchsia)   │  (pink)     │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

| Sub-aba | Conteúdo |
|---|---|
| **Visão Geral** | Tudo do `ClinicFinancial` atual: KPIs do mês, navegação por mês, breakdown por paciente, serviços particulares, pagamento da clínica contratante, exports e dias específicos. |
| **Pacientes** | A seção `PatientBillingManager` (gestão de cobranças mensais por paciente) extraída para destaque próprio com filtros pago/pendente. |
| **Equipe** | O `TeamFinancialDashboard` (hoje em `/team`) renderizado aqui usando o `clinicId` atual + `organizationId` da clínica. Visível **somente quando** `clinic.type === 'clinica'` e o usuário é owner/admin da org (mesma regra usada hoje em Team). Inclui também acesso aos **planos de remuneração** dos terapeutas (gerenciados via `MemberRemunerationLinkModal` e CRUD de planos). |
| **Pacotes** | O novo `ClinicPackagesPanel` com a UI de pacotes movida da aba antiga. |

### 3. Equipe continua acessível via `/team`
Não removemos do menu Equipe — apenas duplicamos o acesso ao dashboard financeiro dentro da clínica para conveniência (compartilhando o mesmo componente, sem duplicar lógica).

### 4. Permissões
- Sub-aba **Equipe** só aparece para `clinic.type === 'clinica'` + `isOwner` ou role admin (espelhando a lógica de `Team.tsx`).
- Sub-aba **Pacotes** sempre visível (já era pública para o owner da clínica hoje).
- Visão Geral e Pacientes seguem regras atuais do `ClinicFinancial` (colaborador vê só os próprios atendimentos).

## Detalhes técnicos

### Arquivos a editar
- `src/components/clinics/ClinicFinancial.tsx`
  - Envolver o conteúdo atual em `<Tabs defaultValue="overview">` com os 4 cards-trigger no topo.
  - O conteúdo atual vira o `<TabsContent value="overview">`.
  - Importar e renderizar `PatientBillingManager`, `TeamFinancialDashboard`, `ClinicPackagesPanel` nas demais sub-abas.
  - Para a sub-aba **Equipe**: buscar `organization_id` da clínica via `useClinicOrg` (já usado no arquivo) e passar para `TeamFinancialDashboard`. Renderizar fallback "Disponível apenas para clínicas com equipe" se não houver org.

### Arquivos a criar
- `src/components/clinics/ClinicPackagesPanel.tsx`
  - Recebe `clinicId`.
  - Encapsula: lista de pacotes, dialogs de novo/editar, export CSV/PDF, `PackagePatientsModal`.
  - Reaproveita `useApp()` para `clinicPackages`, `addPackage`, `updatePackage`, `deletePackage`.
  - As funções `exportPackagesCSV` e `exportPackagesPDF` (hoje em `ClinicDetail.tsx`) são movidas para dentro deste componente.

### Arquivos a editar (remoção)
- `src/pages/ClinicDetail.tsx`
  - Remover `{ value: 'packages', ... }` do array de tabs (linha ~1347).
  - Remover o `<TabsContent value="packages">` inteiro (linhas ~2054–2266) e o dialog de "Editar Pacote" (linhas ~2987+) — passam para `ClinicPackagesPanel`.
  - Remover funções `exportPackagesCSV`/`exportPackagesPDF` e estados `packageDialogOpen`, `newPackage`, `editingPackage`, `viewingPackagePatients` (movidos para o novo componente).

### Sub-aba "Equipe" — sem duplicar lógica
- `TeamFinancialDashboard` já recebe `clinicId` + `organizationId` como props e renderiza tudo (membros, KPIs, breakdown, planos). Apenas reusamos.
- Os planos de remuneração já são acessíveis a partir desse dashboard (via `MemberRemunerationLinkModal` aberto pelos membros).

## Não faz parte deste plano
- Não alterar lógica de cálculo financeiro.
- Não alterar o módulo `/team` (apenas adicionar atalho na clínica).
- Não mover Convênios (`health-plans`) — continua aba própria.
- Não mover Frequência ou Serviços particulares para sub-abas separadas (Serviços já fica embutido na Visão Geral como hoje).

## Resultado visual final na aba Financeiro

```text
[Cards de sub-abas]
 Visão Geral │ Pacientes │ Equipe │ Pacotes

[Conteúdo da sub-aba ativa]
```

Mesma estética dos cards do topo de `ClinicDetail` (rounded-xl, border, bg-card, ícone colorido, ativo com ring-primary).