import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { evolutions, patientName, clinicalArea, isBulk } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const evolutionCount = evolutions.length;
    const evolutionTexts = evolutions
      .map((e: any, i: number) => {
        const date = e.date || "";
        const text = e.text || "(sem texto — sessão registrada)";
        const status =
          e.attendanceStatus === "presente"
            ? "Presente"
            : e.attendanceStatus === "falta"
            ? "Falta"
            : e.attendanceStatus === "reposicao"
            ? "Reposição"
            : e.attendanceStatus || "";
        return `Sessão ${i + 1} (${date} — ${status}):\n${text}`;
      })
      .join("\n\n---\n\n");

    const systemPrompt = `Você é um terapeuta empático que escreve atualizações carinhosas e acessíveis para os pais/responsáveis de um paciente.

Seu objetivo é transformar anotações clínicas técnicas em uma mensagem calorosa, positiva e compreensível para familiares, sem jargões clínicos.

Diretrizes importantes:
- Use linguagem simples, afetuosa e encorajadora
- Foque nos PROGRESSOS e pontos positivos observados
- Se houver dificuldades, mencione-as de forma construtiva e sempre associe a uma estratégia
- Use emojis com moderação (1-2 por parágrafo) para deixar a mensagem mais amigável
- Conclua com uma mensagem de incentivo para a família continuar o acompanhamento em casa
- Escreva em português do Brasil
- Tom: profissional mas caloroso, como uma conversa entre o terapeuta e a família
- NÃO inclua diagnósticos, CIDs ou terminologia médica complexa
- Tamanho: ${isBulk ? "3-5 parágrafos (resumo do período)" : "2-3 parágrafos (sessão individual)"}`;

    const userPrompt = isBulk
      ? `Por favor, crie um resumo do período das sessões de ${patientName}${clinicalArea ? ` (${clinicalArea})` : ""} para enviar aos pais/responsáveis.

Total de ${evolutionCount} sessão(ões) no período:

${evolutionTexts}

Escreva uma mensagem unificada que resuma os principais avanços e observações do período.`
      : `Por favor, crie um feedback amigável da sessão de ${patientName}${clinicalArea ? ` (${clinicalArea})` : ""} para enviar aos pais/responsáveis.

${evolutionTexts}

Transforme esse registro clínico em uma mensagem carinhosa para a família.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes para usar a IA." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      throw new Error(`Erro na IA: ${response.status} — ${t}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
