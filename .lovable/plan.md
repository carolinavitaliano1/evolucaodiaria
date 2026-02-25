

# Simulador de Desconto por Clinica

## O que sera feito

Adicionar um campo de **porcentagem de desconto** que a clinica aplica sobre o valor do terapeuta. Ao definir a porcentagem, o sistema mostra automaticamente o valor bruto e o valor liquido (apos desconto). Essa porcentagem sera salva no cadastro da clinica para nao precisar digitar toda vez.

## Como vai funcionar

1. Na aba **Financeiro** dentro da clinica (`ClinicFinancial`), aparece um campo para digitar a % de desconto
2. Ao alterar, o valor liquido e calculado em tempo real e exibido ao lado do faturamento bruto
3. A porcentagem e salva automaticamente na clinica para uso futuro
4. Na pagina **Financeiro geral** (`Financial.tsx`), o desconto salvo de cada clinica tambem e aplicado nos calculos

## Detalhes tecnicos

### 1. Banco de dados - Nova coluna na tabela `clinics`

```sql
ALTER TABLE public.clinics ADD COLUMN discount_percentage numeric DEFAULT 0;
```

Armazena a porcentagem de desconto da clinica (ex: 30 para 30%).

### 2. Tipos - `src/types/index.ts`

Adicionar `discountPercentage?: number` na interface `Clinic`.

### 3. Contexto - `src/contexts/AppContext.tsx`

Mapear `discount_percentage` para `discountPercentage` no carregamento e no update.

### 4. `src/components/clinics/ClinicFinancial.tsx`

- Adicionar estado local para a porcentagem, inicializado com `clinic.discountPercentage || 0`
- Renderizar um campo de input com icone de % ao lado do card de Faturamento
- Calcular `valorLiquido = totalRevenue * (1 - porcentagem / 100)`
- Exibir dois valores no card: "Bruto" e "Liquido (apos desconto)"
- Ao alterar a porcentagem, salvar automaticamente na clinica via `updateClinic`
- Usar debounce para nao salvar a cada tecla

### 5. `src/components/clinics/EditClinicDialog.tsx`

Adicionar campo de "Desconto da clinica (%)" na secao de pagamento para que o usuario possa configurar tambem pelo dialog de edicao.

### 6. `src/pages/Financial.tsx`

Na secao de faturamento por clinica, aplicar o `discountPercentage` de cada clinica para mostrar o valor liquido ao lado do bruto no resumo geral.

## Resultado visual

No card de Faturamento da clinica, algo como:

```text
Faturamento Bruto     R$ 5.000,00
Desconto clinica      30%
Valor Liquido         R$ 3.500,00
```

Com um slider ou input simples para ajustar a porcentagem.

