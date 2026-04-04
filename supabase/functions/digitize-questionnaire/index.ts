import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { file_base64, file_type, file_name } = await req.json();
    if (!file_base64) {
      return new Response(JSON.stringify({ error: "file_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isImage = file_type?.startsWith("image/");

    const userContent: any[] = [
      {
        type: "text",
        text: `Analise o documento/imagem a seguir e extraia TODAS as perguntas/campos que encontrar.
Para cada pergunta, determine o tipo de campo mais apropriado.

Retorne usando a função extract_questionnaire.`,
      },
    ];

    if (isImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${file_type};base64,${file_base64}` },
      });
    } else {
      // For PDFs, send as text description
      userContent[0].text += `\n\nO arquivo "${file_name}" foi enviado como PDF. O conteúdo base64 está codificado abaixo. Tente interpretar o conteúdo textual.`;
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${file_type || "application/pdf"};base64,${file_base64}` },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente que extrai perguntas de documentos clínicos, questionários e formulários. Extraia cada pergunta e determine o tipo de campo mais adequado. Sempre responda em português brasileiro.",
          },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_questionnaire",
              description: "Extrai as perguntas de um questionário/formulário",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Título do questionário" },
                  description: { type: "string", description: "Descrição breve do questionário" },
                  fields: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        field_type: {
                          type: "string",
                          enum: ["text", "textarea", "select", "yesno", "number"],
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Opções para campo select",
                        },
                        required: { type: "boolean" },
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
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No structured output from AI");
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digitize-questionnaire error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
