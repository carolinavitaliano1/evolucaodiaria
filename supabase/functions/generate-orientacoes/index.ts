import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { patientId, kind, audience, foco } = await req.json();
    if (!patientId || !audience || !kind) {
      return new Response(JSON.stringify({ error: 'patientId, kind e audience são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const anamneseTable = kind === 'psicom' ? 'psicom_anamnese' : 'psico_anamnese';
    const avalTable = kind === 'psicom' ? 'psicom_avaliacoes' : 'psico_avaliacoes';
    const pdiTable = kind === 'psicom' ? 'psicom_pdi' : 'psico_pdi';
    const evoTable = kind === 'psicom' ? 'psicom_evolucoes' : 'psico_evolucoes';

    const [paciente, anamnese, avaliacoes, pdis, evos] = await Promise.all([
      sb.from('patients').select('name, birthdate, observations').eq('id', patientId).maybeSingle(),
      sb.from(anamneseTable).select('*').eq('patient_id', patientId).maybeSingle(),
      sb.from(avalTable).select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(5),
      sb.from(pdiTable).select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(3),
      sb.from(evoTable).select('date, content').eq('patient_id', patientId).order('date', { ascending: false }).limit(10).then(r => r).catch(() => ({ data: [] })),
    ]);

    const prontuario = {
      paciente: paciente.data || null,
      anamnese: anamnese.data || null,
      avaliacoes: avaliacoes.data || [],
      pdis: pdis.data || [],
      evolucoes: (evos as any).data || [],
    };

    const especialidade = kind === 'psicom' ? 'psicomotricista' : 'psicopedagogo(a)';
    const audienceLabel = audience === 'familiar' ? 'família/responsáveis' : 'equipe escolar';

    const systemPrompt = `Você é um(a) ${especialidade} experiente, redigindo orientações práticas para a ${audienceLabel}. Use linguagem clara, acolhedora e acessível (evite jargão técnico excessivo). Baseie-se EXCLUSIVAMENTE nas informações reais do prontuário fornecido — nunca invente diagnósticos, dados ou achados. Quando uma informação não estiver disponível, omita o item. Português brasileiro.`;

    const userPrompt = `Gere um documento de ORIENTAÇÕES para a ${audienceLabel} com base no prontuário abaixo.

Foco/recorte solicitado pelo terapeuta: ${foco || '(não informado — extrair principais necessidades do prontuário)'}

Estrutura desejada:
1. Parágrafo introdutório personalizado citando o nome do paciente e o objetivo das orientações.
2. Seção "Pontos de atenção" — 3 a 6 itens em formato de lista numerada, descrevendo os principais aspectos observados no trabalho clínico.
3. Seção "Estratégias recomendadas" — 5 a 8 estratégias práticas, cada uma em parágrafo curto começando por verbo no infinitivo (Ex.: "Estabelecer rotina visual...", "Oferecer pausas curtas..."). Estratégias devem ser concretas e replicáveis ${audience === 'escolar' ? 'em sala de aula' : 'em casa, no dia a dia'}.
4. Seção "Sinais de alerta" — quando observar mudanças ou agravamentos que devem ser comunicados ao terapeuta.
5. Parágrafo de fechamento reforçando parceria e disponibilidade do(a) profissional.

Entregue APENAS o texto final, sem markdown, sem títulos em maiúsculas tipo "##", apenas com os títulos das seções em linha própria seguidos de dois pontos. Entre 350 e 600 palavras.

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
      if (resp.status === 429) return new Response(JSON.stringify({ error: 'Limite de requisições atingido.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: 'Créditos esgotados.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error('Falha no AI gateway');
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-orientacoes error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro desconhecido' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});