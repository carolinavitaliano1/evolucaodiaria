import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { patientName, moodScore, positiveFeelings, negativeFeelings, suicidalThoughts, notesText, actionPlans, nextSessionNotes, generalComments, durationSeconds, planObjectives, planActivities } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const moodEmojis = ['😭', '😢', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🤩'];
    const moodLabel = moodScore ? `${moodEmojis[moodScore - 1]} ${moodScore}/10` : 'Não informado';
    const durationMin = durationSeconds ? Math.floor(durationSeconds / 60) : 0;

    const prompt = `Você é um psicólogo clínico redigindo uma evolução técnica de sessão terapêutica. Com base nos dados abaixo, gere APENAS o corpo do texto da evolução clínica em português brasileiro. NÃO inclua cabeçalhos como "Evolução Psicológica", "Paciente:", "Modalidade:", "Data:" ou qualquer informação de identificação. Comece diretamente com o conteúdo clínico narrativo. Use linguagem técnica, termos clínicos adequados, e mantenha o texto objetivo e formal. Seja FIEL aos dados fornecidos — descreva apenas o que foi observado, sem inventar ou exagerar. Inclua uma conclusão sintética breve ao final.

DADOS DA SESSÃO:
- Duração: ${durationMin} minutos
- Humor avaliado: ${moodLabel}
- Sentimentos positivos: ${positiveFeelings?.length > 0 ? positiveFeelings.join(', ') : 'Nenhum registrado'}
- Sentimentos negativos: ${negativeFeelings?.length > 0 ? negativeFeelings.join(', ') : 'Nenhum registrado'}
- Ideação suicida: ${suicidalThoughts ? 'SIM - ALERTA' : 'Não reportada'}
- Objetivos terapêuticos do plano: ${planObjectives || 'Não definidos'}
- Atividades planejadas: ${planActivities || 'Não definidas'}
- Anotações da sessão: ${notesText || 'Sem anotações'}
- Planos de ação: ${actionPlans || 'Sem planos'}
- Próxima sessão: ${nextSessionNotes || 'Sem planejamento'}
- Comentários gerais: ${generalComments || 'Sem comentários'}

Gere APENAS o corpo da evolução clínica, sem cabeçalhos de identificação. Seja conciso e direto:`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um psicólogo clínico especialista em redigir evoluções técnicas de sessões terapêuticas. Escreva de forma profissional, com vocabulário técnico-clínico. NÃO inclua cabeçalhos como 'Evolução Psicológica', 'Paciente:', 'Modalidade:' ou dados de identificação. Comece direto com o conteúdo clínico. O texto deve ser conciso, objetivo e entre 200 a 400 palavras." },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
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
      return new Response(JSON.stringify({ error: "Erro ao gerar evolução" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const evolution = result.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ evolution }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-evolution error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
