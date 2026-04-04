
Diagnóstico
- Confirmei que o erro exibido agora vem de `src/pages/Enrollment.tsx` (rota `/matricula/:clinicId`), não da ficha antiga de pré-cadastro.
- A correção do `is_archived` já está no código em `Enrollment.tsx`, então repetir essa troca não deve resolver o problema restante.
- Os pontos que ainda podem gerar “Link inválido” hoje são:
  1. o link ainda é montado com domínio hardcoded antigo em `src/pages/Patients.tsx` e `src/pages/ClinicDetail.tsx`;
  2. o seletor de “Cadastro via Link” em Pacientes usa todas as clínicas, sem excluir arquivadas;
  3. a política de leitura da clínica para matrícula pública está só para `anon`, então um navegador com sessão já aberta pode cair em falso “Link inválido”.

Plano de correção
1. Unificar a geração do link público
- Criar um helper simples para montar a URL pública da matrícula com base no ambiente atual.
- Trocar o hardcoded antigo nos dois pontos que geram/copiam link:
  - `src/pages/Patients.tsx`
  - `src/pages/ClinicDetail.tsx`

2. Impedir geração de link para clínica arquivada
- Em `Patients.tsx`, derivar uma lista de clínicas ativas (`!isArchived`) para o dialog de “Cadastro via Link”.
- Pré-selecionar a primeira clínica ativa, em vez de usar `clinics[0]`.
- Se não houver clínica ativa, mostrar estado vazio e desabilitar a geração do link.

3. Tornar a matrícula pública independente do tipo de sessão
- Ajustar a policy de `clinics` para que a leitura da clínica na matrícula pública funcione tanto para visitante deslogado quanto para navegador com sessão ativa.
- Fazer isso via migration, sem alterar tabelas, apenas a regra de leitura.

4. Melhorar o tratamento de erro em `Enrollment.tsx`
- Separar “clínica não encontrada/arquivada” de “erro de leitura/permissão”.
- Manter “Link inválido” só quando realmente não houver clínica válida.
- Registrar o erro de forma clara para facilitar debug futuro.

5. Validar ponta a ponta
- Gerar link novo pela tela Pacientes.
- Copiar link pela tela da clínica.
- Testar com clínica ativa.
- Confirmar que clínica arquivada não aparece mais como opção.
- Testar o mesmo link em aba anônima e em navegador já logado.
- Validar abertura pelo WhatsApp e no mobile.

Arquivos envolvidos
- `src/pages/Patients.tsx`
- `src/pages/ClinicDetail.tsx`
- `src/pages/Enrollment.tsx`
- `src/lib/utils.ts` (ou um helper pequeno novo para URL pública)
- `supabase/migrations/...` para ajustar a policy de leitura de `clinics`

Detalhes técnicos
- `Enrollment.tsx` já usa filtro compatível com `null/false` para `is_archived`.
- O hardcoded atual está em:
  - `Patients.tsx` na geração do link rápido
  - `ClinicDetail.tsx` no botão “Copiar Link de Cadastro”
- O dialog de Pacientes hoje abre com `clinics[0]?.id` e lista `clinics.map(...)`, sem filtrar clínicas arquivadas.
- A policy atual de matrícula pública está `TO anon`; para uma rota pública, o comportamento mais robusto é não depender de o visitante estar deslogado.
- Essa mudança de policy é segura no contexto atual, porque a mesma leitura já é pública para visitantes sem sessão; o ajuste serve para eliminar a diferença de comportamento entre anon e authenticated.

Resultado esperado
- Links novos deixam de apontar para URL errada.
- O botão de Pacientes não gera mais link morto para clínica arquivada.
- A ficha de matrícula abre corretamente de forma consistente, inclusive quando o usuário já tiver alguma sessão salva no navegador.
