

## Problema Identificado

Na tela de contrato do portal, existem dois problemas visíveis nas screenshots:

1. **Botões sobrepostos**: O `SignaturePad` renderiza seus próprios botões internos ("Limpar" e "Confirmar") E o `PortalContract` renderiza botões externos ("Cancelar" e "Confirmar assinatura"), causando sobreposição visual no mobile.

2. **Falta de dados do assinante**: O contrato não exibe claramente os dados de quem está assinando (nome completo, CPF) antes da assinatura.

3. **Experiência de assinatura ruim**: O pad é pequeno (h-32) e os botões internos conflitam com os externos.

## Plano de Implementação

### 1. Refatorar o SignaturePad (`src/components/ui/signature-pad.tsx`)
- Adicionar prop `hideButtons` para permitir que o componente pai controle os botões
- Expor métodos `clear()` e `save()` via `ref` (useImperativeHandle)
- Aumentar altura padrão do canvas para melhor área de assinatura
- Melhorar responsividade com classes Tailwind adaptativas

### 2. Redesenhar a tela de contrato (`src/pages/portal/PortalContract.tsx`)
- Buscar também o CPF do paciente da tabela `patients` (campos `cpf`, `responsible_cpf`, `responsible_name`, `is_minor`)
- Exibir card com dados do assinante antes da área de assinatura:
  - Nome completo
  - CPF
  - Se menor: indicar "Responsável Legal: [nome]"
- Remover os botões internos do SignaturePad (usar `hideButtons`)
- Renderizar apenas "Cancelar" e "Confirmar assinatura" como botões do PortalContract, em layout responsivo (`flex-col` no mobile, `flex-row` no desktop)
- Aumentar a área de assinatura (h-40 ou h-48)
- Garantir que os botões tenham `w-full` e espaçamento adequado no mobile

### Detalhes Técnicos

**SignaturePad** recebe nova prop e expõe ref:
```typescript
interface SignaturePadProps {
  value?: string;
  onChange?: (signature: string) => void;
  className?: string;
  disabled?: boolean;
  hideButtons?: boolean;
}

// Expor clear/save via useImperativeHandle
export interface SignaturePadRef {
  clear: () => void;
  save: () => void;
}
```

**PortalContract** usa dados do paciente diretamente (já disponíveis via `usePortal().patient`) e busca CPF:
- Usar `patient.is_minor` para determinar menor (ao invés de depender só do intake)
- Buscar `patients.cpf` e `patients.responsible_cpf` junto com os dados existentes
- Layout dos botões: `flex flex-col sm:flex-row gap-2` com botões `w-full`

