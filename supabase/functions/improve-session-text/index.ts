import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, field } = await req.json();
    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "Texto vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const fieldPrompts: Record<string, string> = {
      notes: `Você é um psicólogo clínico. Melhore o texto abaixo que são anotações de sessão terapêutica. Eleve o vocabulário para terminologia técnico-clínica, corrija gramática e ortografia. Pode expandir em até 30% com observações clínicas pertinentes. Preserve fielmente o sentido original. Retorne APENAS o texto melhorado.`,
      action_plans: `Você é um psicólogo clínico. Melhore o texto abaixo que são planos de ação/tarefas para um paciente. Torne as instruções mais claras e profissionais, corrija gramática e ortografia. Pode reorganizar em formato de lista se apropriado. Preserve fielmente o conteúdo original. Retorne APENAS o texto melhorado.`,
      next_session: `Você é um psicólogo clínico. Melhore o texto abaixo que é um planejamento para a próxima sessão terapêutica. Eleve o vocabulário técnico, corrija gramática e ortografia. Torne o planejamento mais estruturado e objetivo. Preserve fielmente o conteúdo original. Retorne APENAS o texto melhorado.`,
      report: `Você é um revisor especializado em textos clínicos de saúde mental. Corrija TODOS os erros de ortografia, gramática, pontuação e concordância do texto abaixo. Melhore a clareza e fluidez sem alterar o conteúdo. Retorne APENAS o texto corrigido.`,
      create_action_plans: `Você é um psicólogo clínico. Com base no contexto clínico fornecido abaixo (anotações de sessão, humor, sentimentos), crie um plano de ação terapêutico estruturado para o paciente. Inclua de 3 a 6 tarefas ou exercícios práticos que o paciente possa fazer entre sessões. Use linguagem clara, direta e empática. Retorne APENAS o plano de ação em formato de lista.`,
      create_next_session: `Você é um psicólogo clínico. Com base no contexto clínico fornecido abaixo (anotações de sessão, humor, sentimentos, planos de ação), crie um planejamento estruturado para a próxima sessão terapêutica. Inclua temas a abordar, técnicas sugeridas e pontos de acompanhamento. Use vocabulário técnico-clínico. Retorne APENAS o planejamento.`,
    };

    const systemPrompt = fieldPrompts[field] || fieldPrompts.notes;

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
          { role: "user", content: text.slice(0, 3000) },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Verifique seu plano." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const improved = data.choices?.[0]?.message?.content || text;

    return new Response(JSON.stringify({ improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-session-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
