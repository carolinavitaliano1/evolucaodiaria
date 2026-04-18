

O usuário relata duas dores principais:
1. **App lento no geral** — carregamento demorado em várias telas.
2. **"Paciente não encontrado"** ao clicar — a tela aparece antes dos dados terminarem de carregar.

Vou investigar as causas-raiz mais prováveis antes de planejar.

**Análise do que já sei pelo contexto:**

- `AppContext.loadInitialData()` carrega TODOS clinics/patients/tasks/packages em uma só vez no login.
- `Patients.tsx` filtra a partir de `useApp().patients` — se o array ainda está vazio, a página renderiza "vazio" antes de hidratar.
- `PatientDetail.tsx` provavelmente faz `patients.find(p => p.id === id)` e mostra "não encontrado" enquanto `loading` ainda é true.
- O log mostra MUITAS requisições paralelas no boot: `patients`, `portal_accounts`, `org_members` (chamado 3x!), `stamps`, `profiles` (2x repetido), `notice_reads` (2x duplicado), `support_chat_sessions` (2x), etc. → várias duplicadas.
- Console mostra warning repetitivo de `RESET_BLANK_CHECK` rodando a cada 500ms (provavelmente do iframe Lovable, ignorável).
- Sem React Query nas páginas principais — tudo via `useEffect` + `supabase` direto, sem cache compartilhado entre rotas.
- Cada navegação re-fetcha do zero. Sem prefetch.

Deixa eu confirmar os pontos críticos rapidamente.
<lov-tool-use id="toolu_vrtx_01NCubL6McjiFC5zYQ6PYZHS" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/PatientDetail.tsx\", \"lines\": \"1-120\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017H3Mk5kVBJ4XjHRDAZ6Sto" name="code--view" integration-id="code" data="{\"file_path\": \"src/contexts/AppContext.tsx\", \"lines\": \"170-340\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013CArjhtMyggeC5XmKzsXN3" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/PatientDetail.tsx\", \"lines\": \"1-150\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Bb3hKT85juaH6ff2bECNvK" name="code--view" integration-id="code" data="{\"file_path\": \"src/contexts/AppContext.tsx\", \"lines\": \"170-360\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01HiRDoTKYHh8as2GWjzGDFf" name="code--search_files" integration-id="code" data="{\"query\": \"não encontrado|Paciente não encontrado|patient not found|notFound\", \"search_dir\": \"src/pages/PatientDetail.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_012GJqV3FZywT2b5xPmyDD74" name="code--search_files" integration-id="code" data="{\"query\": \"isLoading|patients\\\\.find|patient =\", \"include_patterns\": \"src/pages/PatientDetail.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_0124ZbZ7PM19YQFER4UDpmWx" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/PatientDetail.tsx\", \"lines\": \"880-905\"}">
</lov-tool-use>
I have enough context. The "Paciente não encontrado" appears because `patient = patients.find(...)` returns undefined while `isLoading` is still true. Need to use `isLoading` from AppContext instead of failing immediately.
<lov-tool-use id="toolu_vrtx_01QR8Fcds9U7Qf1xmFwoAYer" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/contexts/AppContext.tsx\", \"query\": \"isLoading\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Xbxy4uopqS4TMkPmDjotm3" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/pages/PatientDetail.tsx\", \"query\": \"useApp\\\\(\\\\)|const \\\\{.*\\\\} = useApp\"}">
</lov-tool-use>
Now I have full context. Let me check Clinics page list to understand patient list links, and check for any obvious perf issues.
<lov-tool-use id="toolu_vrtx_01Fim7FBhpJpja7wwj5fuUfk" name="code--view" integration-id="code" data="{\"file_path\": \"src/contexts/AppContext.tsx\", \"lines\": \"1-170\"}">
</lov-tool-use>
I have enough. Now I'll present the plan.

<lov-plan>
## Análise do problema

Identifiquei 2 causas principais para a lentidão e o erro "Paciente não encontrado":

### 1. Bug do "Paciente não encontrado"
Em `src/pages/PatientDetail.tsx` (linha 174 e 893), o código faz:
```
const patient = patients.find(p => p.id === id);
if (!patient) return <p>Paciente não encontrado</p>
```
Como o `AppContext` carrega os pacientes de forma assíncrona (`isLoading: true` no início), na primeira renderização o array `patients` está vazio → mostra "não encontrado" → depois quando os dados chegam, troca para o paciente. Mesma lógica falha em `ClinicDetail`, `GroupDetail` e outras páginas que dependem de `useApp()`.

### 2. Lentidão no carregamento
- `loadInitialData` no `AppContext` faz **queries em série** (primeiro busca org, depois owner, depois clinics, depois patients/tasks/packages em paralelo). O ideal é começar `patients/clinics/tasks/packages` imediatamente em paralelo com a verificação de org.
- Páginas pesadas (`PatientDetail` ~4181 linhas, `ClinicDetail` ~3000+ linhas) são carregadas **eagerly** em `App.tsx` — todas entram no bundle inicial. Sem `lazy()` o usuário baixa tudo no primeiro acesso.
- Múltiplas queries duplicadas em paralelo no Dashboard (visto nos network logs: várias queries idênticas para `profiles?select=is_support_admin` e `organization_members` repetidas).

---

## Plano de correção

### A. Eliminar tela "Paciente não encontrado" durante loading
Em `PatientDetail.tsx`, `ClinicDetail.tsx` e `GroupDetail.tsx`:
- Importar `isLoading` de `useApp()`.
- Mostrar **skeleton/spinner** enquanto `isLoading === true` E o registro ainda não existe.
- Só renderizar "não encontrado" após `isLoading === false` confirmar que de fato sumiu.

### B. Acelerar carregamento inicial (`AppContext.tsx`)
- Disparar as queries de `clinics`, `patients`, `tasks`, `packages` **em paralelo com** a verificação de org (sem esperar).
- Fazer o filtro de org-clinic-ids no cliente (ou via segunda query rápida) sem bloquear o render principal.
- Remover a anti-pattern com `Promise/setState` para checar "alreadyLoaded" — usar diretamente o ref.

### C. Code-splitting das rotas pesadas (`App.tsx`)
- Converter `PatientDetail`, `ClinicDetail`, `GroupDetail`, `Reports`, `AIReports`, `Financial`, `Calendar`, `Mural`, `Team`, `AdminSupport`, páginas Portal e `PatientIntakePublic` para `React.lazy()`.
- Envolver `<Routes>` em `<Suspense fallback={<Spinner/>}>`.
- Resultado: bundle inicial ~50–60% menor → primeira navegação muito mais rápida.

### D. Cache de listas no AppContext
- Manter cópia das listas críticas (`clinics`, `patients`) em `sessionStorage` para que o segundo acesso/refresh hidrate **instantaneamente** enquanto o fetch atualiza em background (stale-while-revalidate).

---

## Arquivos editados
- `src/pages/PatientDetail.tsx` — usar `isLoading` antes de mostrar "não encontrado"
- `src/pages/ClinicDetail.tsx` — mesma correção
- `src/pages/GroupDetail.tsx` — mesma correção
- `src/contexts/AppContext.tsx` — paralelizar queries + cache em sessionStorage
- `src/App.tsx` — `React.lazy` + `Suspense` para rotas pesadas

## Resultado esperado
- Clicar num paciente: aparece instantaneamente (sem flash de "não encontrado")
- Bundle inicial menor → app abre mais rápido
- Refresh subsequente é quase imediato (cache local hidratado antes da query)
