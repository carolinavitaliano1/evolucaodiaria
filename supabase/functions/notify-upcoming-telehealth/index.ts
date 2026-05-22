import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

const PUBLIC_APP_DOMAIN = 'https://evolucaodiaria.app.br';

/**
 * Runs every 5 minutes via pg_cron. For each scheduled video session starting
 * in roughly 10-20 minutes (so any 5-min cron tick catches it once) that has
 * not had its link delivered yet, post a portal message with the access link
 * and stamp link_sent_at to avoid duplicates.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Authenticate the cron caller. Allow both x-cron-secret header and
    // service-role bearer (so it can also be invoked manually by an admin).
    const provided = req.headers.get('x-cron-secret') || '';
    const authHeader = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const isCron = CRON_SECRET && provided === CRON_SECRET;
    const isService = authHeader && authHeader === SUPABASE_SERVICE_ROLE_KEY;
    if (!isCron && !isService) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const windowStart = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // +10 min
    const windowEnd = new Date(now.getTime() + 20 * 60 * 1000).toISOString();   // +20 min

    const { data: sessions, error } = await admin
      .from('video_sessions')
      .select('id, patient_id, therapist_user_id, patient_access_token, scheduled_for')
      .eq('status', 'scheduled')
      .is('link_sent_at', null)
      .not('scheduled_for', 'is', null)
      .gte('scheduled_for', windowStart)
      .lte('scheduled_for', windowEnd);
    if (error) throw error;

    console.log(`notify-upcoming-telehealth: ${sessions?.length ?? 0} session(s) to notify`);

    let sent = 0;
    for (const s of sessions ?? []) {
      try {
        // Find an active portal account for this patient (if any). Without one,
        // the patient cannot read portal messages; skip but still stamp so we
        // don't keep retrying — UI surfaces a "send WhatsApp" button instead.
        const { data: account } = await admin
          .from('patient_portal_accounts')
          .select('id, status')
          .eq('patient_id', s.patient_id)
          .eq('status', 'active')
          .maybeSingle();

        let channel = 'skipped_no_portal';

        if (account?.id) {
          const link = `${PUBLIC_APP_DOMAIN}/teleatendimento/${s.patient_access_token}`;
          const when = s.scheduled_for
            ? new Date(s.scheduled_for).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
              })
            : 'em breve';
          const content =
            `🎥 Sua sessão online começa às ${when}.\n\n` +
            `Toque para entrar na sala:\n${link}\n\n` +
            `Recomendamos abrir o link 2-3 min antes para testar câmera e microfone.`;

          const { error: msgErr } = await admin.from('portal_messages').insert({
            patient_id: s.patient_id,
            therapist_user_id: s.therapist_user_id,
            portal_account_id: account.id,
            sender_type: 'therapist',
            message_type: 'lembrete',
            content,
            read_by_patient: false,
            read_by_therapist: true,
          });
          if (msgErr) throw msgErr;
          channel = 'portal';
        }

        await admin
          .from('video_sessions')
          .update({ link_sent_at: new Date().toISOString(), link_sent_channel: channel })
          .eq('id', s.id);

        sent++;
      } catch (e) {
        console.error('notify-upcoming-telehealth: failed for session', s.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, checked: sessions?.length ?? 0, sent }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('notify-upcoming-telehealth error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});