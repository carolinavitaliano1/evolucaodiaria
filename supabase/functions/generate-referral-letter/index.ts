import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { patientId, especialidade, motivo } = await req.json();
    if (!patientId) {
      return new Response(JSON.stringify({ error: 'patientId é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const [paciente, anamnese, avaliacoes, pdis, evos] = await Promise.all([
      sb.from('patients').select('name, birthdate, observations').eq('id', patientId).maybeSingle(),
      sb.from('psico_anamnese').select('escolar, familiar').eq('patient_id', patientId).maybeSingle(),
      sb.from('psico_avaliacoes').select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(5),
      sb.from('psico_pdi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(3),
      sb.from('psico_evolucoes').select('date, content').eq('patient_id', patientId).order('date', { ascending: false }).limit(10),
    ]);

    const prontuario = {
      paciente: paciente.data || null,
      anamnese: anamnese.data || null,
      avaliacoes: avaliacoes.data || [],
      pdis: pdis.data || [],
      evolucoes: evos.data || [],
    };

    const systemPrompt = `Você é um(a) psicopedagogo(a) experiente redigindo cartas formais de encaminhamento interdisciplinar. Use linguagem técnica, respeitosa e objetiva. Baseie-se EXCLUSIVAMENTE nas informações reais do prontuário fornecido — nunca invente diagnósticos, datas ou achados. Quando uma informação não estiver disponível, omita o item ao invés de preencher com "[...]". A carta deve ter entre 250 e 400 palavras, em português brasileiro.`;

    const userPrompt = `Gere uma carta de encaminhamento formal a partir do prontuário psicopedagógico abaixo.

Destino: ${especialidade || 'profissional especialista'}
Motivo declarado pelo terapeuta: ${motivo || '(não informado — inferir a partir do prontuário)'}

Estruture a carta exatamente assim:
1. Cabeçalho: cidade e data atual.
2. Saudação ao profissional de destino.
3. Parágrafo de apresentação do paciente (nome, idade quando houver, escolaridade quando houver).
4. Parágrafo com síntese clínica: principais achados de avaliação (cite instrumentos quando existirem), histórico relevante da anamnese e evolução do trabalho psicopedagógico.
5. Parágrafo com motivo do encaminhamento e o que se espera da avaliação/intervenção do colega.
6. Parágrafo de fechamento colocando-se à disposição para troca interdisciplinar mediante autorização da família.
7. Linha de assinatura: "_________________________________________" e abaixo "Psicopedagogo(a) responsável".

Devolva APENAS o texto final da carta, sem comentários e sem markdown.

PRONTUÁRIO (JSON):
${JSON.stringify(prontuario).slice(0, 18000)}`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('AI gateway error', resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos esgotados no workspace de IA.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error('Falha no AI gateway');
    }

    const json = await resp.json();
    const carta = json.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ carta }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-referral-letter error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});