import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const docTypeLabels: Record<string, string> = {
  declaracao: "Declaração de Comparecimento",
  frequencia: "Ficha de Frequência",
  recibo: "Recibo de Pagamento",
  livre: "Documento Personalizado",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { docType, patient, clinic, professional, instructions, todayBR, exampleText, templateName, context } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const docLabel = templateName || docTypeLabels[docType] || "Documento";

    const systemPrompt = `Você é um assistente especializado em redigir documentos clínicos, jurídicos e administrativos formais em português brasileiro para profissionais da saúde mental e clínicas. Seu texto deve ser sempre formal, objetivo, juridicamente adequado e respeitoso.

REGRAS ABSOLUTAS:
- NÃO inclua cabeçalhos visuais (logos, linhas, separadores), título do documento ou linha de assinatura — esses elementos são adicionados pelo sistema.
- Gere APENAS o corpo do texto, em parágrafos bem redigidos, sem markdown, sem listas com hífens, sem títulos com #.
- Quando houver MODELO/EXEMPLO de referência, siga RIGOROSAMENTE sua estrutura, tom, formatação e ordem de informações, substituindo apenas os dados pelos do paciente atual.
- Quando houver INSTRUÇÕES do profissional, atenda-as integralmente — elas têm prioridade máxima sobre o modelo padrão.
- Para "Documento Personalizado": REDIJA UM DOCUMENTO COMPLETO E SUBSTANCIAL. Use TODO o contexto disponível do prontuário (evoluções, anamnese/intake, documentos anteriores, diagnóstico, observações) para SINTETIZAR e CONSTRUIR conteúdo clínico coerente em cada seção solicitada — quadro clínico, avaliações, objetivos terapêuticos, intervenções, estratégias, observações, etc.
- NUNCA escreva frases como "Não há informações disponíveis", "Não informado" ou deixe seções vazias. Em vez disso, INFIRA, RESUMA E ELABORE a partir das evoluções, do intake e dos documentos fornecidos no CONTEXTO. Reescreva esse material em linguagem técnica adequada à seção.
- Apenas dados objetivos verificáveis (CPF, datas de nascimento, valores monetários, registros profissionais) NÃO devem ser inventados se ausentes — para esses, omita a linha em vez de escrever "Não informado".
- Para campos clínicos sem dado direto mas COM evoluções/intake disponíveis, é OBRIGATÓRIO derivar conteúdo a partir desse material (ex.: deduzir objetivos terapêuticos a partir de temas recorrentes nas evoluções).`;

    const exampleBlock = exampleText && exampleText.trim()
      ? `\n\nMODELO DE REFERÊNCIA (siga rigorosamente esta estrutura, tom e formatação, substituindo apenas os dados):\n"""\n${exampleText.trim()}\n"""`
      : "";

    const evoList = Array.isArray(context?.evolutions) ? context.evolutions : [];
    const intakeList = Array.isArray(context?.intakeForms) ? context.intakeForms : [];
    const docList = Array.isArray(context?.documents) ? context.documents : [];

    const evoBlock = evoList.length
      ? `\n\nEVOLUÇÕES CLÍNICAS DO PACIENTE (mais recentes primeiro, use para sintetizar quadro, evolução, objetivos, intervenções):\n${evoList.slice(0, 40).map((e: any, i: number) => `[${i + 1}] ${e.date || ''} (${e.status || 's/ status'}${e.mood ? `, humor: ${e.mood}` : ''}): ${(e.text || '').replace(/\s+/g, ' ').trim()}`).join('\n')}`
      : "";

    const intakeBlock = intakeList.length
      ? `\n\nANAMNESE / FICHAS DE INTAKE (use para extrair queixas, histórico, diagnósticos, contexto familiar):\n${intakeList.map((a: any, i: number) => `--- Ficha ${i + 1} ---\n${typeof a === 'string' ? a : JSON.stringify(a).slice(0, 4000)}`).join('\n')}`
      : "";

    const docsBlock = docList.length
      ? `\n\nDOCUMENTOS ANTERIORES DO PRONTUÁRIO (use como referência clínica adicional):\n${docList.map((d: any, i: number) => `[${i + 1}] ${d.title || d.type || 'doc'} (${(d.date || '').slice(0, 10)}): ${(d.excerpt || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`).join('\n')}`
      : "";

    const prompt = `Redija o corpo de um(a) "${docLabel}" com base nos dados abaixo.

DADOS DO PACIENTE:
- Nome: ${patient?.name || "Não informado"}
- Data de nascimento: ${patient?.birthdate || "Não informada"}
- CPF: ${patient?.cpf || "Não informado"}
- Responsável legal: ${patient?.responsibleName || "—"}
- CPF do responsável: ${patient?.responsibleCpf || "—"}
- Diagnóstico registrado: ${patient?.diagnosis || "—"}
- Área clínica/Especialidade: ${patient?.clinicalArea || "—"}
- Observações cadastrais: ${patient?.observations || "—"}
- Início do contrato/terapia: ${patient?.contractStartDate || "—"}
- Frequência semanal (dias): ${Array.isArray(patient?.weekdays) ? patient.weekdays.join(', ') : "—"}

DADOS DA CLÍNICA / ESTABELECIMENTO:
- Nome: ${clinic?.name || "Não informado"}
- CNPJ: ${clinic?.cnpj || "—"}
- Endereço: ${clinic?.address || "—"}

PROFISSIONAL RESPONSÁVEL:
- Nome: ${professional?.name || "Não informado"}
- CPF: ${professional?.cpf || "—"}
- Registro profissional: ${professional?.professionalId || "—"}

DATA DE EMISSÃO: ${todayBR || new Date().toLocaleDateString("pt-BR")}

INSTRUÇÕES ADICIONAIS DO PROFISSIONAL (PRIORIDADE MÁXIMA):
${instructions || "Nenhuma instrução adicional. Redija o documento padrão para o tipo selecionado."}
${exampleBlock}${evoBlock}${intakeBlock}${docsBlock}

REGRAS POR TIPO DE DOCUMENTO:
- Declaração de Comparecimento: declare formalmente que o paciente compareceu à(s) sessão(ões), citando datas/horários se informados nas instruções. Encerre com fórmula padrão "Por ser verdade, firmo o presente."
- Ficha de Frequência: liste de forma estruturada as datas e status de comparecimento mencionados nas instruções, em texto corrido ou tabular simples.
- Recibo: declare o recebimento de valor (citado nas instruções) referente a serviços prestados, com identificação do pagador.
- Documento Personalizado: siga estritamente as instruções fornecidas.

Gere APENAS o corpo do texto, em português brasileiro formal, sem títulos, sem linhas de assinatura, sem markdown. Use de 2 a 12 parágrafos conforme o tipo de documento exigir. Para Documento Personalizado, é OBRIGATÓRIO usar as EVOLUÇÕES, INTAKE e DOCUMENTOS acima para construir conteúdo clínico real em cada seção — proibido escrever "Não informado" ou "Não há informações" em campos clínicos quando há contexto disponível.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2400,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar documento" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const text = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ text, title: docLabel }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-document-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
