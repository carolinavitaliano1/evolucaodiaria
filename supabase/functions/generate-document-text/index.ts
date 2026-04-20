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
    const { docType, patient, clinic, professional, instructions, todayBR } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const docLabel = docTypeLabels[docType] || "Documento";

    const systemPrompt = `Você é um assistente especializado em redigir documentos clínicos formais em português brasileiro para profissionais da saúde mental. Seu texto deve ser sempre formal, objetivo, juridicamente adequado e respeitoso. NÃO inclua cabeçalhos visuais (logos, linhas, separadores), título do documento ou linha de assinatura — esses elementos serão adicionados pelo sistema. Gere APENAS o corpo do texto, em parágrafos bem redigidos. Não invente datas ou informações que não foram fornecidas.`;

    const prompt = `Redija o corpo de um(a) "${docLabel}" com base nos dados abaixo.

DADOS DO PACIENTE:
- Nome: ${patient?.name || "Não informado"}
- Data de nascimento: ${patient?.birthdate || "Não informada"}
- CPF: ${patient?.cpf || "Não informado"}
- Responsável legal: ${patient?.responsibleName || "—"}
- CPF do responsável: ${patient?.responsibleCpf || "—"}

DADOS DA CLÍNICA / ESTABELECIMENTO:
- Nome: ${clinic?.name || "Não informado"}
- CNPJ: ${clinic?.cnpj || "—"}
- Endereço: ${clinic?.address || "—"}

PROFISSIONAL RESPONSÁVEL:
- Nome: ${professional?.name || "Não informado"}
- CPF: ${professional?.cpf || "—"}
- Registro profissional: ${professional?.professionalId || "—"}

DATA DE EMISSÃO: ${todayBR || new Date().toLocaleDateString("pt-BR")}

INSTRUÇÕES ADICIONAIS DO PROFISSIONAL:
${instructions || "Nenhuma instrução adicional. Redija o documento padrão para o tipo selecionado."}

REGRAS POR TIPO DE DOCUMENTO:
- Declaração de Comparecimento: declare formalmente que o paciente compareceu à(s) sessão(ões), citando datas/horários se informados nas instruções. Encerre com fórmula padrão "Por ser verdade, firmo o presente."
- Ficha de Frequência: liste de forma estruturada as datas e status de comparecimento mencionados nas instruções, em texto corrido ou tabular simples.
- Recibo: declare o recebimento de valor (citado nas instruções) referente a serviços prestados, com identificação do pagador.
- Documento Personalizado: siga estritamente as instruções fornecidas.

Gere APENAS o corpo do texto (3 a 6 parágrafos), em português brasileiro formal, sem títulos, sem linhas de assinatura, sem markdown.`;

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
        temperature: 0.3,
        max_tokens: 1200,
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
