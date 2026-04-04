import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_type, file_name, pages_base64 } = await req.json();

    // Support either a single file or multiple page images
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
        text: `Você é um especialista em digitalização de documentos clínicos. Analise TODAS as páginas/imagens do documento a seguir com extremo cuidado.

INSTRUÇÕES CRÍTICAS:
1. Leia CADA página do documento do início ao fim. NÃO pule nenhuma seção.
2. Extraia TODAS as perguntas, campos e itens que encontrar em TODAS as páginas.
3. Para cada pergunta, determine o tipo de campo mais adequado:
   - "text": respostas curtas (nome, data, etc.)
   - "textarea": respostas longas (descrições, observações)
   - "select": quando há opções pré-definidas para escolher
   - "yesno": perguntas de sim/não
   - "number": valores numéricos (idade, peso, etc.)
4. Se houver opções listadas junto à pergunta, inclua-as no array "options".
5. Marque como "required": true as perguntas que pareçam obrigatórias (marcadas com *, obrigatório, etc.)
6. Mantenha a ORDEM original das perguntas no documento.
7. NÃO omita perguntas. Se houver dúvida, inclua.

Retorne usando a função extract_questionnaire com TODAS as perguntas encontradas.`,
      },
    ];

    // Build image content - support multiple pages
    if (pages_base64 && Array.isArray(pages_base64) && pages_base64.length > 0) {
      // Multiple page images sent from frontend
      for (let i = 0; i < pages_base64.length; i++) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:image/png;base64,${pages_base64[i]}` },
        });
      }
    } else if (file_base64) {
      // Single file (image or PDF)
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
            content:
              "Você é um assistente especializado em digitalizar documentos clínicos, questionários, escalas e formulários de saúde. Sua tarefa é extrair TODAS as perguntas de TODAS as páginas do documento, sem omitir nenhuma. Sempre responda em português brasileiro. Use a função fornecida para retornar os dados estruturados.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_questionnaire",
              description: "Extrai todas as perguntas de um questionário/formulário clínico",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do questionário/formulário" },
                  description: { type: "string", description: "Descrição breve do questionário" },
                  fields: {
                    type: "array",
                    description: "Array com TODAS as perguntas encontradas no documento, na ordem original",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "Texto da pergunta" },
                        field_type: {
                          type: "string",
                          enum: ["text", "textarea", "select", "yesno", "number"],
                          description: "Tipo do campo: text (curto), textarea (longo), select (múltipla escolha), yesno (sim/não), number (numérico)",
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Opções para campo select. Vazio para outros tipos.",
                        },
                        required: { type: "boolean", description: "Se a pergunta é obrigatória" },
                      },
                      required: ["question", "field_type"],
                    },
                  },
                },
                required: ["title", "fields"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_questionnaire" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos na sua conta." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No structured output from AI. Full response:", JSON.stringify(result));
      throw new Error("A IA não retornou dados estruturados. Tente novamente.");
    }

    let extracted: any;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr, "Raw:", toolCall.function.arguments);
      throw new Error("Erro ao processar resposta da IA. Tente novamente.");
    }

    // Validate and sanitize output
    if (!extracted.fields || !Array.isArray(extracted.fields)) {
      throw new Error("A IA não retornou perguntas válidas.");
    }

    const validTypes = ["text", "textarea", "select", "yesno", "number"];
    extracted.fields = extracted.fields.map((f: any) => ({
      question: String(f.question || "").trim(),
      field_type: validTypes.includes(f.field_type) ? f.field_type : "text",
      options: Array.isArray(f.options) ? f.options.filter((o: any) => typeof o === "string" && o.trim()) : [],
      required: Boolean(f.required),
    })).filter((f: any) => f.question.length > 0);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digitize-questionnaire error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
