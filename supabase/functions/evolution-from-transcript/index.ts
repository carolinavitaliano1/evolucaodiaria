import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) throw new Error('Missing Authorization');

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: claimsRes, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsRes?.claims?.sub) throw new Error('Invalid session');

    const { transcript, patientName } = await req.json().catch(() => ({}));
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 20) {
      return new Response(JSON.stringify({ error: 'Transcrição muito curta para gerar evolução.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const truncated = transcript.length > 18000 ? transcript.slice(0, 18000) + '\n[...transcrição truncada...]' : transcript;

    const systemPrompt = "Você é um psicólogo clínico especialista em redigir evoluções técnicas de sessões terapêuticas. Escreva de forma profissional, com vocabulário técnico-clínico. NÃO inclua cabeçalhos como 'Evolução Psicológica', 'Paciente:', 'Modalidade:' ou dados de identificação. Comece direto com o conteúdo clínico narrativo. SEJA ABSOLUTAMENTE FIEL ao conteúdo da transcrição: descreva somente o que foi efetivamente dito ou observado, sem inventar, exagerar ou acrescentar informações fictícias. O texto deve ser conciso, objetivo e entre 120 a 250 palavras, com conclusão sintética ao final.\n\nIMPORTANTE — IDENTIFICAÇÃO DE FALANTES: Se a transcrição vier marcada como 'Falante 1', 'Falante 2' etc. (sem indicação explícita de quem é terapeuta ou paciente), infira pelos seguintes sinais contextuais quem é o terapeuta e quem é o paciente: o TERAPEUTA tipicamente faz perguntas clínicas/abertas, devolve interpretações, propõe intervenções e psicoeducação; o PACIENTE tipicamente relata sentimentos, queixas, eventos da semana e responde às perguntas. Use essa inferência apenas para estruturar a narrativa clínica — NÃO mencione 'Falante 1/2' no texto final. Se a inferência for ambígua, prefira uma redação neutra (ex.: 'foi trabalhado...', 'relatou-se que...').";

    const userPrompt = `Com base na transcrição abaixo de uma sessão terapêutica${patientName ? ` com o(a) paciente ${patientName}` : ''}, redija APENAS o corpo da evolução clínica em português brasileiro. Estrutura sugerida (em texto corrido, sem títulos): apresentação do estado e demanda inicial, principais temas trabalhados, intervenções utilizadas, reações/observações do paciente e fechamento com encaminhamentos. Não cite a palavra "transcrição" no texto. Não invente nomes, datas ou diagnósticos não presentes.\n\nTRANSCRIÇÃO DA SESSÃO:\n"""\n${truncated}\n"""\n\nGere agora a evolução clínica (120 a 250 palavras):`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Erro ao gerar evolução' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const evolution = result.choices?.[0]?.message?.content || '';

    return new Response(JSON.stringify({ evolution }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('evolution-from-transcript error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});