import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "Texto vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedText = text.slice(0, 2000);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um assistente especializado em melhorar textos de evoluções clínicas para profissionais de saúde (psicólogos, fonoaudiólogos, terapeutas ocupacionais, fisioterapeutas, etc.).

REGRAS ABSOLUTAS:
1. PRESERVE FIELMENTE o sentido, os fatos e as observações do texto original. Se o profissional disse que o paciente estava "contido", ele NÃO pode aparecer como "colaborativo". Se estava "agitado", NÃO pode virar "calmo". NUNCA inverta ou contradiga o que foi descrito.
2. Eleve o vocabulário para terminologia técnico-clínica apropriada. Corrija gramática e ortografia.
3. Você PODE e DEVE expandir o texto em até 40% em relação ao original, acrescentando:
   - Frases complementares que aprofundam clinicamente o que já foi descrito (ex: contextualizar um comportamento, detalhar uma intervenção).
   - Uma conclusão clínica sintética ao final, se o texto não tiver uma (ex: "Sessão encerrada com [desfecho]. Propõe-se continuidade de [abordagem] na próxima sessão.").
   - Informações técnicas relevantes que DECORREM NATURALMENTE do que foi relatado (sem inventar fatos novos).
4. Mantenha em português brasileiro.
5. NÃO invente diagnósticos, datas, nomes ou dados que não estejam implícitos no texto original.
6. Retorne APENAS o texto melhorado, sem explicações adicionais, sem títulos, sem marcadores.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Melhore o seguinte texto de evolução clínica:\n\n${trimmedText}` },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Lovable AI error:", response.status, errBody);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Verifique seu plano Lovable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const improvedText = data.choices?.[0]?.message?.content || text;

    return new Response(JSON.stringify({ improved: improvedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-evolution error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
