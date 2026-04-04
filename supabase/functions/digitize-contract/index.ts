import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pages_base64, file_base64, file_type, patient_name } = await req.json();

    if (!file_base64 && (!pages_base64 || !Array.isArray(pages_base64) || pages_base64.length === 0)) {
      return new Response(JSON.stringify({ error: "file_base64 ou pages_base64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userContent: any[] = [
      {
        type: "text",
        text: `Você é um especialista em digitalização de contratos e documentos jurídicos para área da saúde/terapia.

INSTRUÇÕES:
1. Analise TODAS as páginas do documento anexado.
2. Converta o conteúdo completo em HTML estruturado e profissional.
3. Mantenha todos os títulos, cláusulas, parágrafos e itens na ordem original.
4. Use tags HTML semânticas: <h2> para título principal, <h3> para cláusulas/seções, <p> para parágrafos, <ul>/<ol> para listas.
5. Preserve formatação como negrito (<strong>) e itálico (<em>) quando detectados.
6. Se encontrar campos em branco ou lacunas para preencher, substitua por {{patient_name}} quando for nome do paciente, ou mantenha o placeholder descritivo entre colchetes [campo].
7. NÃO omita nenhum conteúdo. O contrato digitalizado deve ser completo.
8. O HTML deve ser limpo e pronto para renderização web, sem CSS inline desnecessário.
${patient_name ? `9. O nome do paciente é: ${patient_name}` : ''}

Retorne usando a função extract_contract.`,
      },
    ];

    if (pages_base64 && Array.isArray(pages_base64) && pages_base64.length > 0) {
      for (let i = 0; i < pages_base64.length; i++) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${pages_base64[i]}` },
        });
      }
    } else if (file_base64) {
      const mimeType = file_type || "application/octet-stream";
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${file_base64}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Você é um assistente especializado em digitalizar contratos e documentos jurídicos da área de saúde e terapia. Converta documentos escaneados em HTML estruturado, preservando todo o conteúdo original. Sempre responda em português brasileiro.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract",
              description: "Extrai o conteúdo completo de um contrato e o converte em HTML estruturado",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do contrato (ex: Contrato de Prestação de Serviços)" },
                  html_content: { type: "string", description: "Conteúdo completo do contrato em HTML estruturado, pronto para renderização" },
                },
                required: ["title", "html_content"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contract" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No structured output:", JSON.stringify(result));
      throw new Error("A IA não retornou dados estruturados. Tente novamente.");
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Erro ao processar resposta da IA.");
    }

    if (!extracted.html_content) {
      throw new Error("A IA não retornou o conteúdo do contrato.");
    }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digitize-contract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
