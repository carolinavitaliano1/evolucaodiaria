
## Diagnóstico detalhado

### Causa raiz identificada
O `<a href target="_blank">` dentro de um `Dialog` do Radix UI **não funciona de forma confiável** para abrir janelas externas. O Radix intercepta eventos de clique dentro do Dialog para gerenciar foco e fechamento, o que impede a navegação antes do componente ser desmontado.

O `openWhatsApp()` usa `window.open()` que é bloqueado por popup blockers quando não chamado diretamente de um evento de clique do usuário.

### Solução definitiva — padrão "URL + useEffect fora do Dialog"

A abordagem correta é:
1. Quando o usuário clica em "Abrir no WhatsApp", salvar a URL num `ref` e **fechar o Dialog primeiro**
2. Num `useEffect` que observa o fechamento, abrir a URL com `window.open()` **após** o Dialog ter sido completamente desmontado
3. Como o `useEffect` roda depois do render, o Dialog já está fechado — portanto não é mais "popup não iniciado por clique" do ponto de vista do browser

Porém a forma mais confiável é usar um **link real fora do Dialog** via um portal separado, ou ainda melhor: usar `window.location.href` temporariamente ou um iframe hidden.

### Melhor abordagem: Link renderizado fora do Dialog

Criar um `<a>` invisível **fora do Dialog** no DOM (appended no body), clicar nele via código, e removê-lo. Isso evita o Radix interceptar o clique.

A diferença desta vez das tentativas anteriores:
- Antes: `document.createElement('a').click()` foi chamado dentro do `onClick` handler — o browser ainda considerava isso "sintético" e bloqueava
- Agora: Vamos separar completamente em dois passos: (1) fechar o modal salvando a URL num `ref`, (2) no callback `onAnimationEnd` do fechamento do Dialog, ou num `useEffect` com flag, executar o `a.click()` quando o Dialog já não está no DOM

### Implementação

**`src/components/whatsapp/QuickWhatsAppModal.tsx`**:
- Adicionar `pendingUrlRef = useRef<string | null>(null)`
- Ao clicar "Abrir no WhatsApp": salvar URL no ref, chamar `onClose()`
- Adicionar `useEffect` que observa `open` mudando de `true` para `false`: se `pendingUrlRef.current` tiver URL, criar `<a>` no body, clicar, remover, limpar ref

**`src/hooks/useMessageTemplates.ts`** → função `openWhatsApp()`:
- Mudar de `window.open()` para criar elemento `<a>` e disparar `.click()` — isso funciona para o `QuickWhatsAppButton` nos outros lugares (Dashboard, Agenda)

### Por que vai funcionar desta vez
- O `useEffect` com `open === false` roda **depois** que o Dialog foi removido do DOM
- O `a.click()` é disparado sem contexto de popup blocker porque não está aninhado em nenhum handler de evento sintético do React
- O browser reconhece como navegação normal

### Arquivos a modificar
1. `src/components/whatsapp/QuickWhatsAppModal.tsx` — lógica de abertura com ref + useEffect pós-fechamento
2. `src/hooks/useMessageTemplates.ts` — função `openWhatsApp()` via elemento `<a>` real
