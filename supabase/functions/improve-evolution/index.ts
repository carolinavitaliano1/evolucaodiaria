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

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("GOOGLE_GEMINI_API_KEY is not configured");

    const systemPrompt = `Você é um assistente especializado em melhorar textos de evoluções clínicas para profissionais de saúde (psicólogos, fonoaudiólogos, terapeutas ocupacionais, etc.).

REGRAS ABSOLUTAS:
1. PRESERVE FIELMENTE o sentido, os fatos e as observações do texto original. Se o profissional disse que o paciente estava "contido", ele NÃO pode aparecer como "colaborativo". Se estava "agitado", NÃO pode virar "calmo". NUNCA inverta ou contradiga o que foi descrito.
2. Seu papel é APENAS: corrigir gramática/ortografia, expandir o texto de forma coerente com o que foi dito, e usar vocabulário técnico-clínico apropriado.
3. Amplie e elabore o que já foi escrito — adicione detalhamento clínico que seja uma extensão natural do que o profissional descreveu, sem inventar comportamentos ou situações que não foram mencionadas.
4. Torne o texto mais profissional, objetivo e extenso, mas sempre fiel ao conteúdo original.
5. Mantenha em português brasileiro.
6. NÃO adicione informações contraditórias ao texto original.
7. NÃO mude fatos, datas, comportamentos ou dados clínicos.
8. Retorne APENAS o texto melhorado, sem explicações adicionais.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemPrompt}\n\nMelhore o seguinte texto de evolução clínica:\n\n${trimmedText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1500,
          },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API error:", response.status, errBody);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const improvedText = data.candidates?.[0]?.content?.parts?.[0]?.text || text;

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
