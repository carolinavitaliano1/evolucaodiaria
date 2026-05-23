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

    const [
      paciente, intake,
      anamnesePsico, anamnesePsicom,
      avalsPsico, avalsPsicom,
      pdisPsico, pdisPsicom,
      evosPsico, evosClinicas,
      registrosPsico, registrosPsicom,
      relatoriosPsico, relatoriosPsicom,
      reunioesPsico, reunioesPsicom,
      feedbacks, savedReports,
    ] = await Promise.all([
      sb.from('patients').select('name, birthdate, diagnosis, clinical_area, observations, is_minor, guardian_name, guardian_kinship').eq('id', patientId).maybeSingle(),
      sb.from('patient_intake_forms').select('*').eq('patient_id', patientId).maybeSingle(),
      sb.from('psico_anamnese').select('escolar, familiar').eq('patient_id', patientId).maybeSingle(),
      sb.from('psicom_anamnese').select('motor, familiar').eq('patient_id', patientId).maybeSingle(),
      sb.from('psico_avaliacoes').select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(10),
      sb.from('psicom_avaliacoes').select('*').eq('patient_id', patientId).order('data_avaliacao', { ascending: false }).limit(10),
      sb.from('psico_pdi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
      sb.from('psicom_pdi').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
      sb.from('psico_evolucoes').select('date, content').eq('patient_id', patientId).order('date', { ascending: false }).limit(20),
      sb.from('evolutions').select('date, content, attendance_status').eq('patient_id', patientId).order('date', { ascending: false }).limit(30),
      sb.from('psico_registros').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10),
      sb.from('psicom_registros').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(10),
      sb.from('psico_relatorios').select('titulo, conteudo, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
      sb.from('psicom_relatorios').select('titulo, conteudo, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
      sb.from('psico_reunioes').select('data, modalidade, objetivos, conclusoes').eq('patient_id', patientId).order('data', { ascending: false }).limit(5),
      sb.from('psicom_reunioes').select('data, modalidade, objetivos, conclusoes').eq('patient_id', patientId).order('data', { ascending: false }).limit(5),
      sb.from('evolution_feedbacks').select('content, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
      sb.from('saved_reports').select('title, content, mode, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(5),
    ]);

    const prontuario = {
      paciente: paciente.data || null,
      ficha_admissao: intake.data || null,
      anamnese_psicopedagogica: anamnesePsico.data || null,
      anamnese_psicomotora: anamnesePsicom.data || null,
      avaliacoes_psicopedagogicas: avalsPsico.data || [],
      avaliacoes_psicomotoras: avalsPsicom.data || [],
      pdis_psicopedagogicos: pdisPsico.data || [],
      pdis_psicomotores: pdisPsicom.data || [],
      evolucoes_psicopedagogicas: evosPsico.data || [],
      evolucoes_clinicas: evosClinicas.data || [],
      registros_psicopedagogicos: registrosPsico.data || [],
      registros_psicomotores: registrosPsicom.data || [],
      relatorios_psicopedagogicos: relatoriosPsico.data || [],
      relatorios_psicomotores: relatoriosPsicom.data || [],
      reunioes_psicopedagogicas: reunioesPsico.data || [],
      reunioes_psicomotoras: reunioesPsicom.data || [],
      feedbacks_familia: feedbacks.data || [],
      relatorios_salvos: savedReports.data || [],
    };

    const especialidade = kind === 'psicom' ? 'psicomotricista' : 'psicopedagogo(a)';
    const audienceLabel = audience === 'familiar' ? 'família/responsáveis' : 'equipe escolar';

    const systemPrompt = `Você é um(a) ${especialidade} experiente, redigindo orientações práticas para a ${audienceLabel}. Use linguagem clara, acolhedora e acessível (evite jargão técnico excessivo).

REGRAS ABSOLUTAS DE FIDELIDADE:
- Considere TODAS as seções do JSON (cadastro, ficha de admissão, anamneses, avaliações, PDIs, evoluções, registros, relatórios, reuniões, feedbacks). Use TUDO que estiver disponível, não apenas a anamnese.
- NUNCA invente diagnósticos, dados, escolas, profissionais ou achados que não estejam no JSON.
- Se algo não estiver disponível, OMITA. Não use placeholders como "[...]".
- Português brasileiro.`;

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
${JSON.stringify(prontuario).slice(0, 60000)}`;

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